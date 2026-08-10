export interface CalendarConfig {
  workDays: number[]; // 1=Mon, 7=Sun
  startHour: number;
  hoursPerDay: number;
}

export class CalendarService {
  private holidays: Set<string> = new Set();
  private nonWorkingDays: Set<number> = new Set([7]); // Default Sunday
  private config: CalendarConfig = {
    workDays: [1, 2, 3, 4, 5, 6], // Mon-Sat working
    startHour: 8,
    hoursPerDay: 8,
  };

  /**
   * Carga los días festivos que este calendario debe respetar.
   *
   * Antes esto era un `init()` que consultaba la tabla de festivos en la base de
   * datos con un `try/catch` que hacía `console.error` y seguía. Esa tabla no la
   * poblaba nadie —ni `init-schema.sql` ni `setup_db.js` insertan una sola fila—,
   * así que el conjunto quedaba vacío y el cálculo salía **sin festivos, en
   * silencio**. En la auditoría del 2026-08-10 ese fallo mudo hizo creer que los
   * cronogramas se calculaban sin los ~18 festivos colombianos.
   *
   * No era cierto: la ruta viva (`/api/import-mpp` → `buildProjectDataFromMpp`)
   * aplica `withColombiaHolidays`, que los **calcula** —incluidos los movidos por
   * la ley Emiliani y los derivados de Pascua— y los guarda en el calendario del
   * proyecto. La tabla nunca participó.
   *
   * Ahora los festivos entran explícitamente y el silencio desaparece: si nadie
   * los pasa, el calendario declara que no tiene, en vez de fingir que no existen.
   *
   * @param dates fechas no laborables en formato `YYYY-MM-DD`.
   */
  setHolidays(dates: readonly string[]): void {
    this.holidays = new Set(dates);
  }

  /** Cuántos festivos respeta hoy. Permite distinguir «ninguno» de «no cargados». */
  get holidayCount(): number {
    return this.holidays.size;
  }

  setWorkDays(projectWeekDays: { [key: number]: boolean }) {
    this.nonWorkingDays.clear();
    for (let i = 0; i <= 6; i++) {
      const xmlDay = i + 1;
      if (projectWeekDays[xmlDay] === false) {
        this.nonWorkingDays.add(i);
      }
    }
  }

  isWorkingDay(date: Date): boolean {
    const day = date.getDay();
    const dateStr = date.toISOString().split("T")[0];

    if (this.nonWorkingDays.has(day)) return false;
    if (this.holidays.has(dateStr)) return false;

    return true;
  }

  addDuration(start: Date, minutes: number): Date {
    const current = new Date(start);
    const daysNeeded = Math.ceil(minutes / (this.config.hoursPerDay * 60));

    if (daysNeeded <= 0) return current;

    const loops = daysNeeded - 1;

    for (let i = 0; i < loops; i++) {
      current.setDate(current.getDate() + 1);
      this.skipNonWorkingDays(current);
    }

    return current;
  }

  getNextWorkingDay(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return this.skipNonWorkingDays(d);
  }

  getPreviousWorkingDay(date: Date): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    while (!this.isWorkingDay(d)) {
      d.setDate(d.getDate() - 1);
    }
    return d;
  }

  addLag(start: Date, minutesLag: number): Date {
    const current = new Date(start);
    const days = Math.ceil(minutesLag / (this.config.hoursPerDay * 60));

    for (let i = 0; i < days; i++) {
      current.setDate(current.getDate() + 1);
      this.skipNonWorkingDays(current);
    }
    return current;
  }

  subtractLag(end: Date, minutesLag: number): Date {
    const current = new Date(end);
    const days = Math.ceil(minutesLag / (this.config.hoursPerDay * 60));

    for (let i = 0; i < days; i++) {
      current.setDate(current.getDate() - 1);
      while (!this.isWorkingDay(current)) {
        current.setDate(current.getDate() - 1);
      }
    }
    return current;
  }

  subtractDuration(end: Date, minutes: number): Date {
    const current = new Date(end);
    const daysNeeded = Math.ceil(minutes / (this.config.hoursPerDay * 60));

    if (daysNeeded <= 0) return current;
    const loops = daysNeeded - 1;

    for (let i = 0; i < loops; i++) {
      current.setDate(current.getDate() - 1);
      while (!this.isWorkingDay(current)) {
        current.setDate(current.getDate() - 1);
      }
    }
    return current;
  }

  private skipNonWorkingDays(date: Date): Date {
    while (!this.isWorkingDay(date)) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }
}

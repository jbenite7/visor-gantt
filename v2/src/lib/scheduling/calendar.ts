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
   * Initialize the service by loading holidays from DB.
   * Use simple caching strategies in real apps.
   */
  async init(countryCode: string = "CO"): Promise<void> {
    try {
      // Hybrid Strategy: DB First
      const { default: pool } = await import("@/lib/db");
      const client = await pool.connect();
      try {
        const res = await client.query(
          "SELECT date FROM holidays WHERE country_code = $1",
          [countryCode],
        );
        res.rows.forEach((row) => {
          // Normalize date to YYYY-MM-DD
          const d = new Date(row.date);
          this.holidays.add(d.toISOString().split("T")[0]);
        });
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Failed to load holidays:", err);
    }
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

import { normalizeMppFieldId } from "./fieldLabels";
import { DEFAULT_PROJECT_CALENDAR, type ProjectCalendar } from "@/types/calendar";
import {
  getCalendarMinutesForDate,
  getCalendarMinutesPerDay,
  isProjectWorkingDay,
  normalizeProjectCalendar,
} from "@/lib/scheduling/projectCalendar";

type FormulaValue = string | number | boolean | Date | null;
type DateInterval = "yyyy" | "q" | "m" | "y" | "d" | "w" | "ww" | "h" | "n" | "s";

interface Token {
  type: "number" | "string" | "field" | "identifier" | "operator" | "paren" | "comma";
  value: string;
}

export interface FormulaContext {
  getFieldValue: (fieldId: string) => unknown;
  calendar?: ProjectCalendar;
}

export interface FormulaResult {
  value: FormulaValue;
  error?: string;
}

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const source = formula.trim().replace(/^=/, "");

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "[") {
      const end = source.indexOf("]", index + 1);
      if (end === -1) throw new Error("Campo sin cierre ]");
      tokens.push({ type: "field", value: source.slice(index + 1, end) });
      index = end + 1;
      continue;
    }
    if (char === '"' || char === "'") {
      let end = index + 1;
      let value = "";
      while (end < source.length && source[end] !== char) {
        value += source[end];
        end += 1;
      }
      if (end >= source.length) throw new Error("Texto sin cierre");
      tokens.push({ type: "string", value });
      index = end + 1;
      continue;
    }
    const two = source.slice(index, index + 2);
    if ([">=", "<=", "<>", "!="].includes(two)) {
      tokens.push({ type: "operator", value: two });
      index += 2;
      continue;
    }
    if ("+-*/^&=><".includes(char)) {
      tokens.push({ type: "operator", value: char });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ type: "paren", value: char });
      index += 1;
      continue;
    }
    if (char === "," || char === ";") {
      tokens.push({ type: "comma", value: char });
      index += 1;
      continue;
    }
    const numberMatch = source.slice(index).match(/^\d+(?:\.\d+)?/);
    if (numberMatch) {
      tokens.push({ type: "number", value: numberMatch[0] });
      index += numberMatch[0].length;
      continue;
    }
    const identifierMatch = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_]*/);
    if (identifierMatch) {
      tokens.push({ type: "identifier", value: identifierMatch[0].trim() });
      index += identifierMatch[0].length;
      continue;
    }
    throw new Error(`Token no soportado: ${char}`);
  }

  return tokens;
}

function toNumber(value: FormulaValue): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "boolean") return value ? 1 : 0;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: FormulaValue): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return Boolean(value);
}

function compare(left: FormulaValue, right: FormulaValue, operator: string): boolean {
  const leftValue = typeof left === "string" ? left : toNumber(left);
  const rightValue = typeof right === "string" ? right : toNumber(right);
  switch (operator) {
    case "=":
      return leftValue === rightValue;
    case "<>":
    case "!=":
      return leftValue !== rightValue;
    case ">":
      return leftValue > rightValue;
    case ">=":
      return leftValue >= rightValue;
    case "<":
      return leftValue < rightValue;
    case "<=":
      return leftValue <= rightValue;
    default:
      return false;
  }
}

function parseFormulaDate(value: FormulaValue): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function dateForCalendarDay(date: Date): Date {
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0);
}

function coerceInterval(value: FormulaValue): DateInterval {
  const interval = String(value ?? "d").trim().toLowerCase();
  if (["yyyy", "q", "m", "y", "d", "w", "ww", "h", "n", "s"].includes(interval)) {
    return interval as DateInterval;
  }
  return "d";
}

function calendarMonthDiff(start: Date, finish: Date): number {
  let months = (finish.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    finish.getUTCMonth() - start.getUTCMonth();
  if (finish.getUTCDate() < start.getUTCDate()) months -= 1;
  return months;
}

function dateDiff(interval: DateInterval, start: Date, finish: Date): number {
  const deltaMs = finish.getTime() - start.getTime();
  switch (interval) {
    case "yyyy":
      return finish.getUTCFullYear() - start.getUTCFullYear();
    case "q":
      return Math.trunc(calendarMonthDiff(start, finish) / 3);
    case "m":
      return calendarMonthDiff(start, finish);
    case "ww":
      return Math.trunc(deltaMs / (7 * 24 * 60 * 60 * 1000));
    case "h":
      return Math.trunc(deltaMs / (60 * 60 * 1000));
    case "n":
      return Math.trunc(deltaMs / (60 * 1000));
    case "s":
      return Math.trunc(deltaMs / 1000);
    case "y":
    case "d":
    case "w":
    default:
      return Math.trunc(deltaMs / (24 * 60 * 60 * 1000));
  }
}

function dateAdd(interval: DateInterval, amount: number, start: Date): Date {
  const next = new Date(start);
  switch (interval) {
    case "yyyy":
      next.setUTCFullYear(next.getUTCFullYear() + amount);
      break;
    case "q":
      next.setUTCMonth(next.getUTCMonth() + amount * 3);
      break;
    case "m":
      next.setUTCMonth(next.getUTCMonth() + amount);
      break;
    case "ww":
      next.setUTCDate(next.getUTCDate() + amount * 7);
      break;
    case "h":
      next.setUTCHours(next.getUTCHours() + amount);
      break;
    case "n":
      next.setUTCMinutes(next.getUTCMinutes() + amount);
      break;
    case "s":
      next.setUTCSeconds(next.getUTCSeconds() + amount);
      break;
    case "y":
    case "d":
    case "w":
    default:
      next.setUTCDate(next.getUTCDate() + amount);
      break;
  }
  return next;
}

function dayOfYear(date: Date): number {
  const firstDay = Date.UTC(date.getUTCFullYear(), 0, 1);
  const currentDay = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((currentDay - firstDay) / (24 * 60 * 60 * 1000)) + 1;
}

function weekOfYear(date: Date): number {
  return Math.floor((dayOfYear(date) - 1) / 7) + 1;
}

function datePart(interval: DateInterval, date: Date): number {
  switch (interval) {
    case "yyyy":
      return date.getUTCFullYear();
    case "q":
      return Math.floor(date.getUTCMonth() / 3) + 1;
    case "m":
      return date.getUTCMonth() + 1;
    case "y":
      return dayOfYear(date);
    case "w":
      return date.getUTCDay() + 1;
    case "ww":
      return weekOfYear(date);
    case "h":
      return date.getUTCHours();
    case "n":
      return date.getUTCMinutes();
    case "s":
      return date.getUTCSeconds();
    case "d":
    default:
      return date.getUTCDate();
  }
}

function durationToMinutes(value: FormulaValue, calendar: ProjectCalendar | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean" || value instanceof Date || value == null) return toNumber(value);
  const text = value.trim();
  if (!text) return 0;

  const iso = text.match(/^P(?:(-?\d+(?:\.\d+)?)D)?(?:T(?:(-?\d+(?:\.\d+)?)H)?(?:(-?\d+(?:\.\d+)?)M)?(?:(-?\d+(?:\.\d+)?)S)?)?$/i);
  if (iso) {
    const minutesPerDay = getCalendarMinutesPerDay(normalizeProjectCalendar(calendar ?? DEFAULT_PROJECT_CALENDAR));
    return toNumber(iso[1] ?? 0) * minutesPerDay
      + toNumber(iso[2] ?? 0) * 60
      + toNumber(iso[3] ?? 0)
      + toNumber(iso[4] ?? 0) / 60;
  }

  const duration = text.match(/^(-?\d+(?:\.\d+)?)\s*(mo|mon|month|months|w|wk|week|weeks|d|day|days|h|hr|hour|hours|min|mins|minute|minutes|m|s|sec|secs|second|seconds)?$/i);
  if (!duration) return toNumber(value);
  const amount = Number(duration[1]);
  const unit = String(duration[2] ?? "min").toLowerCase();
  const minutesPerDay = getCalendarMinutesPerDay(normalizeProjectCalendar(calendar ?? DEFAULT_PROJECT_CALENDAR));
  if (["mo", "mon", "month", "months"].includes(unit)) return amount * minutesPerDay * 20;
  if (["w", "wk", "week", "weeks"].includes(unit)) return amount * minutesPerDay * 5;
  if (["d", "day", "days"].includes(unit)) return amount * minutesPerDay;
  if (["h", "hr", "hour", "hours"].includes(unit)) return amount * 60;
  if (["s", "sec", "secs", "second", "seconds"].includes(unit)) return amount / 60;
  return amount;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateValue(date: Date, pattern: string): string {
  const monthsLong = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthsShort = monthsLong.map((month) => month.slice(0, 3));
  return pattern
    .replace(/yyyy/gi, String(date.getUTCFullYear()))
    .replace(/yy/gi, String(date.getUTCFullYear()).slice(-2))
    .replace(/mmmm/gi, monthsLong[date.getUTCMonth()])
    .replace(/mmm/gi, monthsShort[date.getUTCMonth()])
    .replace(/mm/g, pad2(date.getUTCMonth() + 1))
    .replace(/m/g, String(date.getUTCMonth() + 1))
    .replace(/dd/gi, pad2(date.getUTCDate()))
    .replace(/d/gi, String(date.getUTCDate()))
    .replace(/hh/gi, pad2(date.getUTCHours()))
    .replace(/h/gi, String(date.getUTCHours()))
    .replace(/nn/gi, pad2(date.getUTCMinutes()))
    .replace(/n/gi, String(date.getUTCMinutes()))
    .replace(/ss/gi, pad2(date.getUTCSeconds()))
    .replace(/s/gi, String(date.getUTCSeconds()));
}

function groupThousands(value: string): string {
  const [integer, decimal] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal === undefined ? grouped : `${grouped}.${decimal}`;
}

function formatNumberValue(value: number, pattern: string): string {
  const percent = pattern.includes("%");
  const scaled = percent ? value * 100 : value;
  const decimalMatch = pattern.match(/\.([0#]+)/);
  const decimals = decimalMatch ? decimalMatch[1].length : 0;
  const fixed = scaled.toFixed(decimals);
  const grouped = pattern.includes(",") ? groupThousands(fixed) : fixed;
  return percent ? `${grouped}%` : grouped;
}

function formatValue(value: FormulaValue, pattern: string): string {
  const date = parseFormulaDate(value);
  if (date && /y|d|h|n|s/i.test(pattern)) {
    return formatDateValue(date, pattern);
  }
  const numeric = toNumber(value);
  if (Number.isFinite(numeric) && /[0#]/.test(pattern)) {
    return formatNumberValue(numeric, pattern);
  }
  return String(value ?? "");
}

function projectDateDiffMinutes(
  start: Date,
  finish: Date,
  calendar: ProjectCalendar | undefined,
): number {
  const normalized = normalizeProjectCalendar(calendar ?? DEFAULT_PROJECT_CALENDAR);
  const sign = finish.getTime() >= start.getTime() ? 1 : -1;
  const rangeStart = sign > 0 ? start : finish;
  const rangeFinish = sign > 0 ? finish : start;
  const cursor = dateForCalendarDay(rangeStart);
  const end = dateForCalendarDay(rangeFinish);
  let workingMinutes = 0;
  while (cursor.getTime() <= end.getTime()) {
    if (isProjectWorkingDay(cursor, normalized)) {
      workingMinutes += getCalendarMinutesForDate(cursor, normalized);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return sign * workingMinutes;
}

function projectDateAdd(
  start: Date,
  durationMinutes: number,
  calendar: ProjectCalendar | undefined,
): Date {
  const normalized = normalizeProjectCalendar(calendar ?? DEFAULT_PROJECT_CALENDAR);
  const sign = durationMinutes >= 0 ? 1 : -1;
  let remainingDays = Math.max(0, Math.ceil(Math.abs(durationMinutes) / getCalendarMinutesPerDay(normalized)));
  const current = new Date(start);
  while (remainingDays > 1) {
    current.setUTCDate(current.getUTCDate() + sign);
    if (isProjectWorkingDay(current, normalized)) remainingDays -= 1;
  }
  return current;
}

class Parser {
  private position = 0;

  constructor(
    private tokens: Token[],
    private context: FormulaContext,
  ) {}

  parse(): FormulaValue {
    const value = this.parseOr();
    if (this.peek()) throw new Error("Fórmula con tokens sobrantes");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private consume(): Token {
    return this.tokens[this.position++];
  }

  private match(type: Token["type"], value?: string): boolean {
    const token = this.peek();
    if (!token || token.type !== type) return false;
    if (value !== undefined && token.value.toUpperCase() !== value.toUpperCase()) return false;
    this.position += 1;
    return true;
  }

  private matchIdentifier(value: string): boolean {
    return this.match("identifier", value);
  }

  private parseOr(): FormulaValue {
    let left = this.parseAnd();
    while (this.matchIdentifier("OR")) {
      const right = this.parseAnd();
      left = toBoolean(left) || toBoolean(right);
    }
    return left;
  }

  private parseAnd(): FormulaValue {
    let left = this.parseComparison();
    while (this.matchIdentifier("AND")) {
      const right = this.parseComparison();
      left = toBoolean(left) && toBoolean(right);
    }
    return left;
  }

  private parseComparison(): FormulaValue {
    let left = this.parseConcat();
    while (this.peek()?.type === "operator" && ["=", "<>", "!=", ">", ">=", "<", "<="].includes(this.peek()!.value)) {
      const operator = this.consume().value;
      const right = this.parseConcat();
      left = compare(left, right, operator);
    }
    return left;
  }

  private parseConcat(): FormulaValue {
    let left = this.parseAdditive();
    while (this.match("operator", "&")) {
      const right = this.parseAdditive();
      left = `${left ?? ""}${right ?? ""}`;
    }
    return left;
  }

  private parseAdditive(): FormulaValue {
    let left = this.parseMultiplicative();
    while (this.peek()?.type === "operator" && ["+", "-"].includes(this.peek()!.value)) {
      const operator = this.consume().value;
      const right = this.parseMultiplicative();
      left = operator === "+" ? toNumber(left) + toNumber(right) : toNumber(left) - toNumber(right);
    }
    return left;
  }

  private parseMultiplicative(): FormulaValue {
    let left = this.parseUnary();
    while (this.peek()?.type === "operator" && ["*", "/"].includes(this.peek()!.value)) {
      const operator = this.consume().value;
      const right = this.parseUnary();
      left = operator === "*"
        ? toNumber(left) * toNumber(right)
        : toNumber(right) === 0
          ? 0
          : toNumber(left) / toNumber(right);
    }
    return left;
  }

  private parseUnary(): FormulaValue {
    if (this.match("operator", "-")) return -toNumber(this.parseUnary());
    if (this.matchIdentifier("NOT")) return !toBoolean(this.parseUnary());
    return this.parsePower();
  }

  private parsePower(): FormulaValue {
    const left = this.parsePrimary();
    if (this.match("operator", "^")) {
      const right = this.parseUnary();
      return Math.pow(toNumber(left), toNumber(right));
    }
    return left;
  }

  private parsePrimary(): FormulaValue {
    const token = this.consume();
    if (token.type === "number") return Number(token.value);
    if (token.type === "string") return token.value;
    if (token.type === "field") return this.normalizeValue(this.context.getFieldValue(normalizeMppFieldId(token.value)));
    if (token.type === "identifier") {
      if (this.match("paren", "(")) {
        const args: FormulaValue[] = [];
        if (!this.match("paren", ")")) {
          do {
            args.push(this.parseOr());
          } while (this.match("comma"));
          if (!this.match("paren", ")")) throw new Error("Función sin cierre )");
        }
        return this.callFunction(token.value, args);
      }
      const upper = token.value.toUpperCase();
      if (upper === "TRUE") return true;
      if (upper === "FALSE") return false;
      return this.normalizeValue(this.context.getFieldValue(normalizeMppFieldId(token.value)));
    }
    if (token.type === "paren" && token.value === "(") {
      const value = this.parseOr();
      if (!this.match("paren", ")")) throw new Error("Paréntesis sin cierre");
      return value;
    }
    throw new Error(`Token inesperado: ${token.value}`);
  }

  private normalizeValue(value: unknown): FormulaValue {
    if (value == null) return null;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
    return String(value);
  }

  private callFunction(name: string, args: FormulaValue[]): FormulaValue {
    switch (name.replace(/\s+/g, "").toUpperCase()) {
      case "IIF":
      case "IF":
        return toBoolean(args[0]) ? args[1] ?? null : args[2] ?? null;
      case "ROUND":
        return Number(toNumber(args[0]).toFixed(Math.max(0, toNumber(args[1] ?? 0))));
      case "INT":
        return Math.floor(toNumber(args[0]));
      case "FIX":
        return Math.trunc(toNumber(args[0]));
      case "ABS":
        return Math.abs(toNumber(args[0]));
      case "SGN": {
        const value = toNumber(args[0]);
        return value > 0 ? 1 : value < 0 ? -1 : 0;
      }
      case "MIN":
        return Math.min(...args.map(toNumber));
      case "MAX":
        return Math.max(...args.map(toNumber));
      case "MOD": {
        const divisor = toNumber(args[1]);
        return divisor === 0 ? 0 : toNumber(args[0]) % divisor;
      }
      case "SQR":
      case "SQRT":
        return Math.sqrt(Math.max(0, toNumber(args[0])));
      case "EXP":
        return Math.exp(toNumber(args[0]));
      case "LOG": {
        const value = toNumber(args[0]);
        return value > 0 ? Math.log(value) : 0;
      }
      case "SIN":
        return Math.sin(toNumber(args[0]));
      case "COS":
        return Math.cos(toNumber(args[0]));
      case "TAN":
        return Math.tan(toNumber(args[0]));
      case "ATN":
        return Math.atan(toNumber(args[0]));
      case "LEN":
        return String(args[0] ?? "").length;
      case "LEFT":
        return String(args[0] ?? "").slice(0, Math.max(0, Math.trunc(toNumber(args[1] ?? 0))));
      case "RIGHT": {
        const text = String(args[0] ?? "");
        const length = Math.max(0, Math.trunc(toNumber(args[1] ?? 0)));
        return text.slice(Math.max(0, text.length - length));
      }
      case "MID": {
        const text = String(args[0] ?? "");
        const start = Math.max(1, Math.trunc(toNumber(args[1] ?? 1)));
        const length = args[2] == null ? undefined : Math.max(0, Math.trunc(toNumber(args[2])));
        return length === undefined ? text.slice(start - 1) : text.slice(start - 1, start - 1 + length);
      }
      case "INSTR": {
        const hasStart = args.length >= 3;
        const start = hasStart ? Math.max(1, Math.trunc(toNumber(args[0] ?? 1))) : 1;
        const source = String(args[hasStart ? 1 : 0] ?? "");
        const needle = String(args[hasStart ? 2 : 1] ?? "");
        const index = source.indexOf(needle, start - 1);
        return index >= 0 ? index + 1 : 0;
      }
      case "STRCOMP": {
        const left = String(args[0] ?? "");
        const right = String(args[1] ?? "");
        const comparison = left.localeCompare(right);
        return comparison < 0 ? -1 : comparison > 0 ? 1 : 0;
      }
      case "REPLACE": {
        const source = String(args[0] ?? "");
        const find = String(args[1] ?? "");
        const replacement = String(args[2] ?? "");
        return find ? source.split(find).join(replacement) : source;
      }
      case "TRIM":
        return String(args[0] ?? "").trim();
      case "LTRIM":
        return String(args[0] ?? "").trimStart();
      case "RTRIM":
        return String(args[0] ?? "").trimEnd();
      case "UCASE":
        return String(args[0] ?? "").toUpperCase();
      case "LCASE":
        return String(args[0] ?? "").toLowerCase();
      case "VAL": {
        const match = String(args[0] ?? "").trim().match(/^-?\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : 0;
      }
      case "CSTR":
        return String(args[0] ?? "");
      case "FORMAT":
        return formatValue(args[0], String(args[1] ?? ""));
      case "CINT":
      case "CDBL":
        return toNumber(args[0]);
      case "ISNULL":
        return args[0] == null;
      case "ISDATE":
        return parseFormulaDate(args[0]) !== null;
      case "NZ":
        return args[0] == null || args[0] === "" ? args[1] ?? 0 : args[0];
      case "AND":
        return args.every(toBoolean);
      case "OR":
        return args.some(toBoolean);
      case "NOT":
        return !toBoolean(args[0]);
      case "DATEVALUE": {
        const date = new Date(String(args[0] ?? ""));
        return Number.isNaN(date.getTime()) ? null : date;
      }
      case "DATESERIAL":
        return new Date(Date.UTC(
          Math.trunc(toNumber(args[0])),
          Math.trunc(toNumber(args[1])) - 1,
          Math.trunc(toNumber(args[2])),
        ));
      case "DATEPART": {
        const date = parseFormulaDate(args[1]);
        return date ? datePart(coerceInterval(args[0]), date) : null;
      }
      case "DATEDIFF": {
        const start = parseFormulaDate(args[1]);
        const finish = parseFormulaDate(args[2]);
        if (!start || !finish) return null;
        return dateDiff(coerceInterval(args[0]), start, finish);
      }
      case "DATEADD": {
        const start = parseFormulaDate(args[2]);
        if (!start) return null;
        return dateAdd(coerceInterval(args[0]), toNumber(args[1]), start);
      }
      case "PROJDATEDIFF": {
        const start = parseFormulaDate(args[0]);
        const finish = parseFormulaDate(args[1]);
        if (!start || !finish) return null;
        return projectDateDiffMinutes(start, finish, this.context.calendar);
      }
      case "PROJDATEADD": {
        const start = parseFormulaDate(args[0]);
        if (!start) return null;
        return projectDateAdd(start, durationToMinutes(args[1], this.context.calendar), this.context.calendar);
      }
      case "PROJDATESUB": {
        const finish = parseFormulaDate(args[0]);
        if (!finish) return null;
        return projectDateAdd(finish, -durationToMinutes(args[1], this.context.calendar), this.context.calendar);
      }
      case "PROJDATEVALUE":
      case "PROJDATECONV":
        return parseFormulaDate(args[0]);
      case "PROJDURVALUE":
      case "PROJDURCONV":
        return durationToMinutes(args[0], this.context.calendar);
      case "DAY": {
        const date = parseFormulaDate(args[0]);
        return date ? date.getUTCDate() : null;
      }
      case "MONTH": {
        const date = parseFormulaDate(args[0]);
        return date ? date.getUTCMonth() + 1 : null;
      }
      case "YEAR": {
        const date = parseFormulaDate(args[0]);
        return date ? date.getUTCFullYear() : null;
      }
      case "HOUR": {
        const date = parseFormulaDate(args[0]);
        return date ? date.getUTCHours() : null;
      }
      case "MINUTE": {
        const date = parseFormulaDate(args[0]);
        return date ? date.getUTCMinutes() : null;
      }
      case "SECOND": {
        const date = parseFormulaDate(args[0]);
        return date ? date.getUTCSeconds() : null;
      }
      case "SWITCH":
        for (let index = 0; index < args.length - 1; index += 2) {
          if (toBoolean(args[index])) return args[index + 1] ?? null;
        }
        return null;
      case "CHOOSE": {
        const index = Math.trunc(toNumber(args[0]));
        return index > 0 ? args[index] ?? null : null;
      }
      case "NOW":
        return new Date();
      default:
        throw new Error(`Función no soportada: ${name}`);
    }
  }
}

export function extractFormulaDependencies(formula: string | undefined): string[] {
  if (!formula) return [];
  const matches = [...formula.matchAll(/\[([^\]]+)]/g)];
  return [...new Set(matches.map((match) => normalizeMppFieldId(match[1])))];
}

export function evaluateCustomFormula(
  formula: string | undefined,
  context: FormulaContext,
): FormulaResult {
  if (!formula?.trim()) return { value: null };
  try {
    const parser = new Parser(tokenize(formula), context);
    return { value: parser.parse() };
  } catch (error) {
    return {
      value: null,
      error: error instanceof Error ? error.message : "Fórmula no soportada",
    };
  }
}

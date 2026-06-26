/**
 * ArrowPath — SVG path calculation for dependency arrows.
 *
 * Each dependency type has a distinct routing strategy:
 *   FS: finish → right 10px → vertical → finish at successor start
 *   SS: start  → left 10px  → vertical → finish at successor start
 *   FF: finish → right 10px → vertical → finish at successor finish
 *   SF: start  → left 10px  → vertical → finish at successor finish
 */

export type DependencyType = "FS" | "SS" | "FF" | "SF";

const OFFSET = 10; // px — horizontal lead-out before the vertical segment
const SAME_ROW_BEND = 12; // px — vertical offset when from/to are on the same row

/**
 * Calculate the SVG `d` attribute string for a dependency arrow.
 *
 * @param fromX  Source x coordinate (start or finish of predecessor)
 * @param fromY  Source y coordinate (vertical center of predecessor row)
 * @param toX    Target x coordinate (start or finish of successor)
 * @param toY    Target y coordinate (vertical center of successor row)
 * @param type   Dependency type: FS | SS | FF | SF
 * @param rowHeight  Row height used to compute same-row offset
 * @returns      SVG path `d` attribute string
 */
export function calculateArrowPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  type: DependencyType,
): string {
  // When source and target are on the same row, offset the vertical
  // segment so the arrow doesn't overlap the bar.
  const sameRow = Math.abs(fromY - toY) < 1;
  const effectiveToY = sameRow ? fromY + SAME_ROW_BEND : toY;

  // Horizontal lead direction depends on type:
  //   FS, FF → lead RIGHT  (from finish)
  //   SS, SF → lead LEFT   (from start)
  const leadRight = type === "FS" || type === "FF";
  const leadX = leadRight ? fromX + OFFSET : fromX - OFFSET;

  // Build L-shaped path:
  //   1. Start at (fromX, fromY)
  //   2. Horizontal to leadX
  //   3. Vertical to effectiveToY
  //   4. Horizontal to toX
  return `M ${fromX},${fromY} H ${leadX} V ${effectiveToY} H ${toX}`;
}

/**
 * Return the SVG marker-end direction for the last segment of the path.
 * Used by DependencyArrow to orient the arrowhead polygon.
 */
export function getArrowDirection(
  fromX: number,
  _fromY: number,
  toX: number,
  _toY: number,
  type: DependencyType,
): "left" | "right" {
  // The arrowhead must follow the final horizontal segment. This matters when
  // the successor starts at or before the lead-out point, such as FS into a
  // same-day milestone.
  const leadRight = type === "FS" || type === "FF";
  const leadX = leadRight ? fromX + OFFSET : fromX - OFFSET;
  return toX >= leadX ? "right" : "left";
}

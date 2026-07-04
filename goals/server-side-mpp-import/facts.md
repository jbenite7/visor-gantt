# Facts

- The application provides a shared server-side .mpp import path that can be used by both the home upload control and the /upload page.
- When a user imports a valid .mpp file from the home page, the browser uploads the original file and does not send the parsed project JSON back through saveProject or another large Server Action payload.
- A successful .mpp import saves a complete project in the database and redirects the user to /project/<id>.
- The saved project preserves the parsed schedule data needed by the existing project view, including tasks, resources, assignments, calendars, MPP columns, custom fields, and calculated fields.
- Invalid files, parser failures, unauthorized users, and save failures return clear user-facing errors without creating partial projects.
- The Server Actions bodySizeLimit is left at the smallest value that remains necessary after the server-side import path is implemented, and any high limit is justified by an automated or manual check.
- Local and production e2e verification import a real .mpp file through the UI, confirm there is no POST / 500 payload-limit failure, confirm the project record is created, and confirm the resulting /project/<id> page opens.

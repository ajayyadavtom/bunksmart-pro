# BunkSmart Pro

BunkSmart Pro is a simple, privacy-friendly web app for students to track class attendance, see exactly how many classes they can safely skip ("bunk") or need to attend, and estimate their semester grades.

## How to Open & Use It

### Option 1: Run the Local / Mobile Dev Server (`npm run dev`)
1. Run `npm run dev` in the project folder.
2. Open `http://localhost:3000` on your computer, or open the printed `Mobile: http://<your-ip>:3000` URL on your phone (connected to the same Wi-Fi).

### Option 2: Open Directly
Open `index.html` in any modern web browser (Chrome, Edge, Firefox, Safari) — no installation or internet connection required.
2. **Setup & Timetable**: Enter your minimum attendance goal (default `75%`), pick your weekly holidays, and list each day's classes separated by commas (for example: `Maths, Physics, CS`).
3. **Daily Roll Call**: Pick a date (defaults to Today) and mark each class as **Present**, **Absent**, or **Cancelled** (click an active button again to clear it). You can also log extra/makeup classes or mark a full day as a holiday.
4. **Attendance Dashboard**: View your overall and subject-by-subject percentage along with plain-English advice (such as *"Safe to skip 2"* or *"Attend next 3"*). You can also add subjects with existing counts or edit counts mid-semester.
5. **Grade Predictor**:
   - **SGPA Calculator**: Add your subjects, credit hours, and expected grades to see your 10-point SGPA live.
   - **Final Exam (SEE) Score Needed**: Enter your internal marks and total internal maximum (20, 25, 30, 40, or 50) to see the minimum final exam score out of 100 needed to reach your target grade.

## Data & Privacy

All data is stored locally in your browser via `localStorage`. You can export or import a JSON backup anytime from **Setup & Timetable**.

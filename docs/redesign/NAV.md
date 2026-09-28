# OpenSets navigation rules

Written 2026-09-28 after Noah's report: "it feels really buggy and clunky ... does it make
sense to reset this page or does it make sense to go back and it goes to this page". Each
rule is checked by pressing things, in `scripts/nav-check.mjs` (`npm run design:nav`).
Before these rules were built, 7 of the 23 cases passed.

Lens: an iOS interaction designer checking against Apple's navigation conventions.

1. **Back returns to the screen you came from.** The Back button and the edge swipe land
   in the same place: the screen that opened this one, not a fixed parent. A screen opened
   cold (a reload on it) goes back to its natural parent. Every push records its origin
   (`location.state.from`), and going back restores the origin with its own history.
2. **Coming back, the screen is as you left it.** Scroll, the open day on Plan, search
   text and filters.
3. **A new tab starts fresh** (Noah, 09-28). **Tapping the tab you are on goes to its top.**
4. **A task returns to where it began**, on Save, Cancel or swipe: the builder, the plan
   questions, the workout.
5. **The workout sits over the screen that started it.** The down arrow tucks it away and
   leaves you where you were. A Workout in progress bar on every tab brings it back, and
   Today shows the day actually in progress.
6. **Leaving with unsaved edits asks first.**
7. **Every weight says what it is:** per hand for dumbbells, total with the bar for
   barbells, stack for machines, added for bodyweight lifts.
8. **You can see a day's weights before you start it,** on Plan.
9. **Every button does something, and what its label says.** Checked by the interaction
   crawler (step 2 of the plan).
10. **Sheets close by swipe, Cancel or the dim area, and leave the screen alone.**
11. **Reopening the app lands somewhere sensible:** in a workout, the workout; otherwise
    where iOS relaunches the Home Screen app (Today).
12. **Anything destructive asks or offers Undo.**

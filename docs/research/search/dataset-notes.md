# OpenSets exercise dataset: notes for search

Notes only; nothing here was changed. Source: `public/data/exercises.json` (873 exercises from free-exercise-db at the pinned SHA b0eed06). Each item says what it breaks for search or filters and what I would do.

## 1. Names that hide what the exercise is

These are the "pec fly" problem in general form: the dataset name is not what a lifter calls it. Aliases fix search for all of them. For the worst ones, also consider a **display name** in the Hevy style (common name, then a clarifier in parentheses) while keeping the id.

| Dataset name | What it actually is (from its instructions) | Suggested display name |
|---|---|---|
| Butterfly | Seated pec deck machine fly | **Butterfly (Pec Deck)**, exactly Hevy's name |
| Reverse Machine Flyes | Reverse pec deck, rear delts | Reverse Pec Deck (Rear Delt Machine) |
| Air Bike | Bicycle crunch on the floor. Collides with the fan bike cardio machine that people also call an "air bike" | Bicycle Crunch |
| Weighted Squat | Belt squat: weight hangs from a hip belt between two benches | Belt Squat |
| Chair Squat (machine) | Smith machine squat with the feet forward | Smith Machine Squat (Feet Forward) |
| Lunge Sprint (machine) | Smith machine split squat | Smith Machine Split Squat |
| Leverage Chest Press, Iso Row, High Row, Shoulder Press, Incline/Decline Chest Press, Shrug, Deadlift | Plate-loaded lever machines, the Hammer Strength "Iso-Lateral" style | Iso-Lateral Chest Press (Plate-Loaded), and so on. Lifters say "Hammer Strength" |
| Thigh Abductor / Thigh Adductor | Hip abduction / adduction machine | Hip Abduction Machine / Hip Adduction Machine |
| Knee/Hip Raise On Parallel Bars | Captain's chair knee raise (vertical knee raise station) | Captain's Chair Knee Raise |
| Calf Press | Seated calf press machine (leg-press style) | Calf Press (Machine) |
| Lying Triceps Press | Skull crusher with an EZ bar | Skull Crusher (EZ Bar) |
| Natural Glute Ham Raise / Floor Glute-Ham Raise | Nordic hamstring curl (pad-anchored / partner-anchored) | Nordic Curl (Machine Pad) / Nordic Curl (Partner) |
| Split Squat with Dumbbells | Rear foot elevated, so a Bulgarian split squat | Bulgarian Split Squat (Dumbbell) |
| Smith Single-Leg Split Squat | Bench behind, so a Smith Bulgarian split squat | Bulgarian Split Squat (Smith Machine) |
| Barbell Hack Squat | Barbell held behind the legs (behind-the-back deadlift), **not** the hack squat machine. A "hack squat" search should put Hack Squat (machine) first | Barbell Hack Squat (Behind the Back) |
| Kettlebell One-Legged Deadlift | Single-leg RDL | Single-Leg RDL (Kettlebell) |
| Dumbbell Incline Row / Lying T-Bar Row / Lying Cambered Barbell Row | Chest-supported rows (dumbbell / T-bar machine / seal-row style) | Chest-Supported Row (Dumbbell), and so on |
| Straight-Arm Pulldown | Also called a lat prayer | fine as is, alias covers it |
| Star Jump | UK name; the US name is jumping jack | fine, alias covers it |
| Stairmaster | A brand used as the exercise name | Stair Climber |
| Split Squats | A **stretch** (category stretching), not the lift. Ranks for "split squat" | Split Squat Stretch |
| Crossover Reverse Lunge | A **stretch**, yet it is the only exercise literally named "reverse lunge". The lift is Dumbbell Rear Lunge | Crossover Reverse Lunge Stretch |
| Bottoms Up | An ab exercise, not the kettlebell bottoms-up press | Bottoms Up (Ab) |
| Bodyweight Flyes | Flyes rolling on two EZ bars in a push-up position; equipment ezBar | Rolling EZ-Bar Fly |

## 2. Duplicates and near-duplicates

Search returns both, and a lifter logs history under whichever one they tap first, which splits their data. **Choose one per pair** (hide the other from search, or merge history), or at least keep them adjacent with a distinguishing display name.

| Pair | Relationship |
|---|---|
| EZ-Bar Skullcrusher and Lying Triceps Press | Same movement, both EZ bar |
| Triceps Overhead Extension with Rope and Cable Rope Overhead Triceps Extension | Same movement, both rope on a low pulley |
| Barbell Squat and Barbell Full Squat | Same lift; only the depth cue differs |
| Front Barbell Squat and Front Squat (Clean Grip) | Same lift, grip note only |
| Standing Military Press and Barbell Shoulder Press | Overlap (standing barbell overhead press) |
| Barbell Bench Press - Medium Grip and Bench Press - Powerlifting | Same lift; the powerlifting one is tagged **triceps** primary |
| Dips - Triceps Version and Parallel Bar Dip | Same movement on parallel bars |
| Pushups, Pushups (Close and Wide Hand Positions) and Push-Up Wide | Overlapping push-up variants |
| Natural Glute Ham Raise and Floor Glute-Ham Raise | Both Nordic curls |
| Squat with Bands (barbell) and Squats - With Bands (bands) | The only same-word pair in the dataset. One is a barbell squat with band tension, the other a band-only squat. Names do not say which |
| Iron Cross (dumbbell), Cable Iron Cross, Iron Crosses (stretch) | Three different things with one name |

## 3. Labels that break filters and muscle-plus-equipment search

The recommended search lets "cable chest" match on the equipment and muscle fields, so wrong labels become wrong results.

**Equipment contradicts the name (6 real errors):**
- Close-Grip EZ Bar Curl is tagged `barbell`; EZ-Bar Curl is `ezBar`.
- Decline EZ Bar Triceps Extension is tagged `barbell`.
- Smith Incline Shoulder Raise is tagged `barbell`; every other Smith exercise is `machine`.
- Band Assisted Pull-Up, Seated Band Hamstring Curl and Weighted Sit-Ups - With Bands are tagged `other`, not `bands`.

(The 10 "with bands" and "reverse band" barbell lifts are correctly `barbell`: the bar is the primary load. Two "Barbell" names are tagged `ezBar`, Lying Close-Grip Barbell Triceps Press To Chin and Reverse Barbell Preacher Curls; minor, since an EZ bar is a barbell.)

**No equipment at all:** 77 exercises. Most are stretches, but six are bodyweight strength lifts that drop out of a Bodyweight filter: Bodyweight Walking Lunge, Decline Push-Up, Floor Glute-Ham Raise, Inverted Row, Prone Manual Hamstring, Scapular Pull-Up.

**Primary muscle looks wrong:**
- Cable Hip Adduction is tagged `quadriceps`; it trains the adductors.
- Bench Press - Powerlifting and Bench Press with Chains are tagged `triceps`, so a Chest filter hides the competition bench press.
- Trap Bar Deadlift and Leverage Deadlift are tagged `quadriceps`. That is defensible for a trap bar pull, but it drops them from a "back" or "hamstrings" search.
- Flutter Kicks is tagged `glutes`.

**Category looks wrong:** Superman and Scissor Kick are `stretching`, so they get the stretch penalty in ranking.

## 4. Naming style that makes matching harder

- Hyphenation is inconsistent: "Pushups" and "Pullups" versus "Push-Up Wide" and "Chin-Up". The normalizer must treat "push up", "push-up" and "pushup" as one word. The prototype handles the first two; "pushup" relies on aliases.
- "Flyes", "Flye" and "Fly" are mixed, and "Curls"/"Curl", "Raises"/"Raise" and "Lunges"/"Lunge" mix plural and singular. Stemming is required.
- Typos and casing in names: "Dumbbell Tricep Extension -Pronated Grip", "Seated One-arm Cable Pulley Rows".
- "SMR" (self-myofascial release) means foam rolling; nobody types it. The prototype reaches these through the `foamRoll` equipment field, but a "foam roll" alias on the 11 SMR exercises would be clearer.

## 5. Common lifts that are not in the dataset

Search cannot find what does not exist. These came up while writing the benchmark and are what a commercial-gym lifter would look for: **burpee, wall sit, Pendlay row, pendulum squat, hip thrust machine, machine lateral raise, standing cable lateral raise, assisted pull-up machine (only band-assisted exists), two-arm kettlebell swing (only one-arm), fan bike (Assault/Echo), seated machine row (a cable row and plate-loaded rows exist)**. Adding these as first-party exercises, or making "create custom" one tap from a failed search, closes the gap.

## 6. Aliases to review before shipping

`alias-sources.json` tags every alias with an evidence strength. Of 760 aliases: 164 are exact names in an app or database, 300 are **part of a longer exercise name**, and 296 are used in running text. The weak cases in the spot-check all came from the middle group. Review these 46 single-word aliases from that group first, because a single word matches broadly:

bench, crossover, flyes, dips (x2), dip (x3), deadlifts, sumo, hyperextension, hyperextensions, pulldown, chins, facepull, shrugs (x2), curl, pushdown, skullcrushers, kickback (x2), kickbacks, squats, zercher, pistol, lunges (x2), nordic, nordics (x2), bridge, abductors, adductors, planks, rollout, deadbug, pallof, woodchopper, bicycles, jackknife, supermans, elliptical, ropes, thrusters, slams.

Removed during the work: "press" (would pin the overhead press to the top of every "press" search) and "ass to grass" (a one-letter typo of "abs" matched it).

## 7. Ambiguous abbreviation

**SLDL** means stiff-legged deadlift in one glossary ([theproteinchef](https://theproteinchef.co/fitness-abbreviations/)) and single-leg deadlift in two others ([themillgym](https://themillgym.com/acronyms), [prevail](https://prevailstrengthandfitness.com/gym-news/2017-11-16-what-are-all-those-acronyms-28saa/)). The benchmark accepts both, and the alias file maps SLDL to Stiff-Legged Barbell Deadlift and Kettlebell One-Legged Deadlift. Search should return both families, not pick one.

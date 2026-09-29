# Japanese Math Drill — Specification (public release)

Japanese Math Drill is a browser game in which the mascot's movements, the on-screen effects and the music build up with every calculation you solve. It is an unofficial US English localization of Dopa Drill (ドパドリル) by gear_machine. This document describes how the current implementation behaves, for players and their parents or guardians, and for anyone interested in developing or modifying the game. Numbers may change in future tuning.

## 1. Overview and design philosophy

The aim is an experience in which you keep practicing calculation a little every day and can see how you have grown compared with your past self. The basic problems can be continued even after the time runs over, and solving all of them gives 100 points. There is no game over.

A wrong answer is shown as "Oops" and can be answered again. Stars, trophies and effects you have earned are never taken away because of mistakes or missed days. Streaks have a mechanism that makes up for days you took off, and growth comparisons show only the items that improved. Rewards are unlocked by meeting conditions; nothing is obtained through random draws or payments.

The interface is in US English by default; Japanese, the game's original language, can be chosen with the language menu in Settings. It supports both calculation practice for elementary school students and use by adults. It is designed mainly for smartphones in portrait orientation, and can also be played on a PC with a mouse and keyboard. No account registration is required. Records are kept per browser, so there is no automatic sync with other devices.

The Japanese version is the original Dopa Drill itself, kept unchanged in `app/ja/` apart from the language menu and the back button on the play screen. Its text, the ドパドリル logo, Dopa written with the four-digit units 万 and 億, remainders written with あまり and mixed numbers such as 2と1/3 are all the original's. This document describes the English version.

## 2. Screens and flow

### 2.1 List of screens

| Screen | Contents and main actions |
| --- | --- |
| Title | Logo (a small "JAPANESE" tag, big bouncing "MATH" letters and a "DRILL" ribbon), Dopakichi, My Level, Review directly below it, Grade 1 to Grade 6, Skill Tree, Trophies, Collection, Today's Quests, Calendar, Settings, ? |
| Play | Round back button at the top left (back to the title, after a confirmation), problem, answer cells to fill in, dedicated number pad, number correct, Oops count, clock, Dopa, combo, progress indicator, mute |
| Basic results | 100 points, time, first-try rate, Dopa, and the growth, skill and quest results. Buttons for Extra (when its condition is met), redoing missed problems, playing again and going back to the title |
| Final results | Score and Dopa including Extra, number correct, Oops count, quests, and buttons for redoing missed problems and going back to the title |
| Skill Tree | Prerequisite links, unlocked / learning / mastered status, stars, rust, skill details and practice, partial erasing of records |
| Trophies | Achievements by category and series, dates earned, conditions and rewards, filters, achievements that are almost earned |
| Collection | Previewing and test-listening to unlocked effects, and choosing a fixed item or Shuffle for each category |
| Settings | Language (English / Japanese), number of problems, sound, volume, motion, demo play, resetting all data |

The usual flow is "title → basic problems → basic results → optional Extra → final results". Review ends at the basic results. The action buttons on the results screens are pinned to the bottom edge, so that you can move on to the next action even when the growth records get long.

### 2.2 First-run guide and "?" help

On first launch, a 5-page guide is shown, in this order: introduction, My Level, by grade, Skill Tree, and a page recommending My Level. The "?" below the Settings button shows the explanation again as 7 pages, with Trophies and Collection added.

The element being explained is lit by a spotlight, scrolling as needed. The explanatory text is shown in a separate card, and Dopakichi guides by moving, pointing and making faces. The text is not presented as Dopakichi's lines. The last page points to "My Level" and "?"; if both cannot fit on the screen at the same time, the same question-mark icon is shown inside the card.

The guide is operated with "Next", "Back", "Skip" and, on the last page, "Let's go!". Enter and the right arrow go to the next page, the left arrow goes to the previous page, Escape skips, and Tab moves the focus within the guide. Pressing the dimmed backdrop does not close it, and the buttons in the background cannot be operated while the guide is open.

Whether the guide is viewed to the end or skipped, it is saved as shown. After the first-run guide, the Streak Hammer, the login bonus and trophy notifications are processed, in that order. After a full reset, the first-run guide is shown again. It is not shown automatically during the demo or with some of the testing URLs.

## 3. Modes

### 3.1 My Level

The first time is a "skill check". It moves through the skills ordered by grade and then by prerequisite depth; a right answer on the first try marks the skill asked, together with its prerequisite skills, as mastered at ☆1. The step size starts at 6; after a correct answer it becomes 1.3 times the current step, rounded up, with a maximum of 12; after a wrong answer it is halved, rounded down, with a minimum of 1. After a wrong answer, the check moves back, but stays within the range after the position of the last first-try correct answer. Finishing the basic problems marks the check as done.

After that, problems are chosen based on prerequisite depth, grade and skill definition order. Problems for review are chosen from the last 6 mastered skills, and the review slots are `min(candidate count, max(1, round(problem count × 0.3)))` problems. Rusty skills take priority, and the rest are chosen at random from the candidates. If no skill is mastered yet, there are 0 review slots.

The remaining problems cycle in order through the first 4 skills that are unlocked but not yet mastered. If every skill is mastered, they are chosen from all mastered skills. Extra cycles through the last 3 unmastered candidates or, if there are none, the last 3 mastered skills. The Extra right after the check takes the first skill that is unlocked but not yet mastered.

### 3.2 By grade

Basic problems are drawn from the skills of the chosen grade, whether or not they are unlocked. The order goes from shallow to deep prerequisite depth, with some random jitter added. The answers also count toward normal mastery.

The first 6 Extra problems cycle through the grade's skill list from position `floor(skill count × 0.55)` onward. From the 7th problem, it switches to the first 4 skills (at most) of the next grade. In Grade 6, it continues with the latter part of the same grade.

### 3.3 Practice

You choose an unlocked skill from the Skill Tree and practice it. For a mastered skill, practice can be started from its details screen. Basic problems come from that skill, and Extra problems come from unlocked skills that have that skill as a direct prerequisite. If there are none, the same skill continues.

In by-grade play and Practice, a time capsule that meets its conditions may replace 1 of the basic problems. That 1 problem may fall outside the chosen grade or skill.

### 3.4 Review

When a problem that included a wrong answer is solved to the end, the problem itself is saved, up to 40 problems. Duplicates are removed using the problem's title and expression as its identifier. Unfinished problems abandoned partway are not added.

Review can be started from the Review button on the title screen or from the "Redo missed problems" button on the results screens. Problems are taken from the end of the saved list, up to the smaller of the configured number of problems and 10. Even when it is started from the results button, it is not limited to that play's wrong answers; it uses the list, including problems left over from before.

Problems redone right on the first try are removed from the list, and problems answered wrong again stay in it. Solving all of them gives 100 points, and there is no Extra. Review also counts toward the normal growth records, mastery and quests.

### 3.5 Demo play

The "Watch it play itself" button in Settings starts automatic play. Problems chosen from all skills are ordered from easy to hard, and Extra problems are chosen from Grade 4 and higher skills. It uses the normal input, judging and effects, and also makes wrong answers. The maximum number of basic problems with a wrong answer is `floor(problem count × 0.2)`.

After 1 round of the basic problems, Extra and the final results, it returns to the title screen and the demo ends. It can also be stopped with a tap or a key press. Taps right after it starts are ignored for 600ms. Demo play results are not added to the history, mastery, Review or growth statistics, and they do not advance quests or trophies. The normal login processing does run after it returns to the title screen.

Fixed effect choices are used in the demo too; only the categories set to Shuffle pick from the unlocked items. The `?demo` URL parameter is a separate feature from this automatic play.

## 4. A single play and input

### 4.1 Basic problems and Extra

The number of problems is 6, 10 or 14, with a default of 10. The basic goal time is `ceil(problem count × 18 ÷ 10) × 10` seconds: 110 seconds for 6 problems, 180 seconds for 10 and 260 seconds for 14. You can keep going after exceeding it, and no points are deducted. The basic elapsed time runs from the start of play until the set is finished, including the transitions between problems.

"Correct" is the number of problems completed through the final answer, and "Oops" is the number of times an accepted digit was wrong for the current cell. "Right on the first try" (first-try correct) means a problem completed without a single wrong answer, including intermediate inputs. If the number of basic problems right on the first try divided by the number of problems is 0.8 or higher, you can choose Extra.

Extra lasts 90 seconds by default. Its deadline is set by adding 90,000ms plus 900ms for the intro to the time at which its start processing runs. It does not guarantee 90 seconds from the moment input first becomes possible; the clock keeps running during transitions between problems. It stops while a confirmation dialog is open. When time runs out, the score is finalized and the game moves on to the final results. An unfinished problem earns no points, but the Dopa gained from correct cells already accepted is kept.

### 4.2 Entering digits

Answers are entered 1 digit at a time with the dedicated number pad or the PC's number keys, and each digit is judged immediately. There is no button to submit an answer. Correct digits stay in place, and a wrong digit is replaced by the next input. Backspace erases the current wrong digit; it does not undo digits already answered correctly.

On smartphones, the problem's margins and the number pad's height are adjusted to the visible area, taking the browser's toolbars into account. The bottom row, which contains 0 and delete, is placed above the bottom safe area, and the problem's font size is also recalculated when the screen size changes.

| Problem format | Input order and automatic display |
| --- | --- |
| Horizontal expression | Answer digits entered starting from the left |
| Horizontal division with a remainder | Quotient, then remainder (written with "R": 17 ÷ 5 = 3 R 2) |
| Column addition and subtraction | Starting from the lowest place. The helper digits for carrying and borrowing are shown automatically |
| Column multiplication | Partial products entered from the right; when there are several partial products, their sum is also entered from the right |
| Long division | Quotient digit starting from the highest place, the difference after subtracting, then the next quotient digit. The product, the digit brought down and a final remainder of 0 are shown automatically |
| Decimals | The decimal point is shown automatically; only digits are entered |
| Fractions | Denominator, then numerator. Mixed numbers (written "2 1/3"): whole-number part, denominator, then numerator |
| Ratios, find x, rounding, percentages | Entered starting from the left digit of the designated blank |

Horizontal expressions follow English word order, for example "10 is 3 and [7]", "1/4 of 12 = [3]", "25 % of 200 = [50]", "GCF of 12 and 18" / "= [6]" (two lines) and "Round 34567" / "to the nearest 100" / "→ [34600]" (three lines). A word takes about one digit cell per three letters. The answer line shown after a problem is solved reads "problem = answer", except for number bonds ("10 is 3 and 7"), equal ratios ("2:3 = 6:9") and find x ("x = 4").

Fractions are judged against the prepared answer format. For Grade 3 fractions with like denominators, the original denominator is kept and the unsimplified answer is accepted. Other fraction calculations use the generated form in lowest terms or as a mixed number. Freely entering an equivalent alternative form and having it judged is not supported.

### 4.3 Wrong answers and clues

A wrong digit gets a purple dotted border. After 2 wrong answers in the same cell, the digits to refer to are highlighted and pointed at, if they are defined. From the 3rd wrong answer on, a clue such as an intermediate step of the calculation or a row of the times table is shown. A clue may contain a value equivalent to the answer.

A wrong answer resets the combo to 0, but it does not reduce the score or Dopa, and the effect level and background music are kept. The background music is briefly turned down for the wrong-answer sound, and a bouncy sound effect and Dopakichi's recovery act are used.

## 5. Score, Dopa and combo

### 5.1 Score

Finishing the basic set gives 100 points. If the completed Extra problems are numbered `k` starting from 0, that problem adds `10 + 5 × k` points. The total score after completing `n` Extra problems is:

```text
100 + 10 × n + 5 × n × (n − 1) ÷ 2
```

That is 200 points for 5 problems, 425 for 10, 775 for 15, 1595 for 23 and 2575 for 30. There is no fixed upper limit on the score. There are no score multipliers or deductions based on combo, answer speed or the Oops count.

### 5.2 Calculating Dopa

Dopa is a number for the show, separate from the score. It is stored internally as a common (base-10) logarithm `L`, and the displayed value is based on `10^L`. At the start of play, `L = 0`.

The base curve for the basic set is `B(f) = 2.3 × clamp(f, 0, 1)^1.15`, and the base curve for Extra is `X(n) = 2.3 + 3.0 × (1 − exp(−n / 10))`.

Let `N` be the total number of basic problems, `q` the number of completed problems (counting from 0), `m` the number of answer cells in the current problem, and `s` the cell just answered correctly (counting from 1). The base increment for that input is `B((q + s/m)/N) − B((q + (s−1)/m)/N)`. With `k` the number of completed Extra problems, the base increment for 1 cell is `(X(k+1) − X(k))/m`.

On a correct answer, the combo count `c` is first increased by 1, and then the input is applied as follows:

```text
multiplier M(c) = 1 + (2 − 1) × min(1, max(0, c) / 20)
new L = min(9.08, L + max(0.003, base increment) × M(c))
```

A 10 combo gives ×1.5, and a combo of 20 or more gives ×2. The cap is 9.08 as a logarithm, which is exactly `10^9.08` (about 1.2 billion) as the underlying display value. Because the increment has a minimum of 0.003, the value actually reached cannot be determined from the end points of the base curves alone. Even the first correct answer counts as a 1 combo (×1.05), and when Extra starts, the combo is reset to 0 while Dopa carries over.

Below one million, the display is rounded to a whole number with commas ("123,456"); from one million up, short-scale names are used ("1.2 million", "345 million", "1.2 billion", then trillion, quadrillion and so on up to vigintillion, with "∞" from `10^66`). When the value within a unit is below 10, it is shown to 1 decimal place; at 10 or more, the truncated whole number is shown. Reaching every power of ten from 100 to 100 million (100, 1,000, 10,000, 100,000, 1 million, 10 million, 100 million), and then 1 billion, 1 trillion and so on (one per short-scale name), triggers a milestone effect; the 100 milestone is shown small. With the cap in normal play, Dopa never reaches a trillion or more.

### 5.3 Combo timing and display

Each correct answer cell adds 1 combo, and the combo carries over across problems. It is displayed from a combo of 2, and from 20 combo it shows "Dopa ×2 MAX". It returns to 0 on a wrong answer or when its time runs out. However, in the current implementation, a combo of 1 is exempt from the time-out check.

For grade `g`, the time for a regular cell is `3000 + 600 × (g − 1)` ms, and 2500ms is added for the first cell of a problem. The grade is clamped to 1–6 and treated as 3 when unknown.

| Grade | Regular cell | First cell of a problem |
| --- | --- | --- |
| 1 | 3000ms | 5500ms |
| 2 | 3600ms | 6100ms |
| 3 | 4200ms | 6700ms |
| 4 | 4800ms | 7300ms |
| 5 | 5400ms | 7900ms |
| 6 | 6000ms | 8500ms |

The deadline is set at the moment input is accepted, and no time is used up during problem transitions or confirmation dialogs. The remaining-time bar is highlighted below 30%. There is a big celebration at 10, 20, 30, 50 and 75 combo, and every 50 combo from 100 on. When a combo of 5 or more breaks, the count it reached is shown briefly.

## 6. Problem range and Skill Tree

### 6.1 Range and generation

Calculation is divided into 58 skills. By grade, there are 8 in Grade 1, 13 in Grade 2, 14 in Grade 3, 10 in Grade 4, 8 in Grade 5 and 5 in Grade 6. Grades are shown as "Grade 1" to "Grade 6" but follow Japan's curriculum (for example, the times tables are in Grade 2). There are 4 branches: "Add & subtract", "Multiply & divide", "Decimals & fractions" and "Other". The names, identifiers, prerequisites and generation conditions of all skills are listed in `docs/curriculum.md`.

The range covers the four arithmetic operations, column calculations with intermediate inputs, decimals, fractions, rounding, factors and multiples, order of operations, percentages, equal ratios and finding the value of x. Geometry, measurement, graphs, word problems and input in kanji numerals are not included.

Problems are generated at random each time from the skill's conditions. Repeats are avoided using the signatures of the last 24 problems and the signatures already asked in the current play. Because candidate generation has a retry limit, repeats can occur, for example in skills with few possible candidates. The time capsule and Review are exceptions, since they reproduce the same problem.

### 6.2 Display and unlocking

The tree is shown in 8 columns, with each branch split into 2 columns, and scrolls vertically and horizontally on narrow screens. Skills are arranged in grade order first, with Grades 5 and 6 placed below Grades 1 to 4. Prerequisite lines detour around other nodes, and sitting in the same column does not by itself mean a dependency.

Skills without prerequisites are unlocked from the start; if a skill has several prerequisites, all of them must be mastered. The states are locked, NEW, learning and mastered. The normal mastery condition is a history of at least 6 problems, with 5 or more of the last 6 right on the first try. Once mastered, a skill does not go back, even after wrong answers. The bulk grant from the skill check is an exception to this count condition.

### 6.3 Skill stars

After mastery, ☆1 to ☆5 are earned in order. The condition for each level must be met 1 step at a time, but if several are met, a single check can raise several levels. The maximum total is 290.

Speed is judged by the ratio of each problem's answer time to a base time. The base time is `first-cell combo time + max(0, answer cells − 1) × regular-cell combo time`. The median ratio is computed only from the first-try correct problems among those considered.

| Star | Condition |
| --- | --- |
| ☆1 | Mastered |
| ☆2 | A full set of the last 20 problems, with a first-try rate of 0.9 or higher |
| ☆3 | A full set of the last 10 problems, at least 5 of them right on the first try, with a median time ratio of 1 or less |
| ☆4 | The last 3 problems all right on the first try, each dated 7 or more days after the day ☆3 was earned |
| ☆5 | A full set of the last 20 problems, a first-try rate of 0.95 or higher and a median time ratio of 0.6 or less |

The 3 problems for ☆4 do not have to be on the same day. Stars never decrease through normal play or breaks; they are removed by erasing the skill's records or by a full reset. The details screen shows the condition for the next star, the current values, the number of problems solved and the fastest answer time.

### 6.4 Rust

Mastered skills for which `21 × 86400000` ms or more have passed since the last first-try correct answer are candidates, and "rust" is shown on up to 3 of them, oldest first. If there is no time of a first-try correct answer, the time of the skill-check grant and then the time of mastery are used instead.

Answering 1 problem of a rusty skill right on the first try polishes it: the mark disappears and the stars are kept. Polishing one skill may bring another old skill into the displayed set. Rust is used for My Level's review slots and for the polish quest.

### 6.5 Erasing skill records

Long-pressing a skill that has records for 600ms, or focusing it and pressing Delete, opens a confirmation. If the pointer moves more than 10px from where it was pressed, the long press is canceled.

On confirmation, the records and stars of that skill and of every skill that depends on it, directly or indirectly, are erased. The chosen skill goes back to NEW if its prerequisites are still in place, or to locked if they are not all mastered. The history, Review, lifetime statistics, trophies, collection and the skill-check-done state are kept.

## 7. Mechanisms for continued play

### 7.1 History, Calendar and login bonus

A history entry is saved at the basic results, and after Extra ends, the same entry's score, additional correct count, Oops and Dopa are updated. Up to 3000 entries are kept. The Calendar shows each day's best score and number of plays, and tapping a date opens that day's details. The weekday header runs from "Sun" to "Sat", month titles read like "September 2026", and dates are shown like "Sep 3". You can move back to past months but not ahead to future months.

The streak is counted from today or, if you have not played yet today, from yesterday. The longest streak and the number of login stickers are also shown. Days played and login days are separate: just opening the title screen does not make it a day played.

There is 1 login bonus per device date. Stickers come in a 7-day cycle: star, heart, flower, music note, clover, flower circle and crown. A missed day that has not been saved with the Streak Hammer restarts the cycle from the beginning. The sticker counts as received when the bonus is displayed, so closing it or reloading does not give a second one on the same day.

### 7.2 Streak Hammer

1 hammer saves 1 day you did not play, joining up the play and login streaks. It does not add that day to the days played or add a sticker for the missed day. You start with 1 hammer and can hold up to 3.

When your last day played is within the last 7 days, all the empty days up to yesterday can be filled with the hammers you hold, and a streak of 2 or more days can be saved, the title screen offers to use it (1 time per day). On a day you decline, it is not offered again. Using it puts a "SAVED" stamp on the Calendar. Up to 50 uses are kept in the log.

### 7.3 Daily quests

From the device date and the records at the time the day's quests are chosen, 2 easy quests and 1 that takes more effort are decided and saved. On the same day they are not chosen again, even if the settings change. After the date changes, the next refresh switches to a new list. The candidates are 11 fixed quests plus 1 that depends on rust.

| Slot | Candidates and completion conditions |
| --- | --- |
| Easy | Play once, Get a 5 combo, Get 5 right on the first try, Review 1 problem, Solve 1 from a NEW skill |
| More effort | Reach Extra, Solve 5 in Extra, Get a 20 combo, Play twice, Play a grade once, Solve 10 from skills you are learning (NEW or learning skills), Polish "[skill]" (3 problems): 3 first-try correct answers in the specified skill |

When there is nothing to review or no NEW skill, the corresponding candidates are excluded. The Extra quests require an Extra record in the last 5 history entries, the 20 combo requires `problem count × average answer cells >= 26`, and the 10 learning problems require that the skill check is done and that there is an unmastered candidate. Two quests with the same metric are never given on the same day.

The time model used for the selection counts 1 play as `(problem count × 18 + 90 if Extra is expected + 30) / 60` minutes. It allows `ceil(5 / (problem count × 0.7))` plays for 5 first-try correct answers, `ceil(10 / (problem count × 0.6))` plays for the 10 learning problems and 2 plays for the 20 combo. Review is counted as at most 10 problems, quests that can be completed together across modes are overlapped, and a combination totaling 15 minutes or less is chosen. This is an estimate and does not limit the actual time taken.

The polish candidate is eligible on a day when there is rust, if a random number derived from the date is below 0.5 and it has been offered fewer than 2 times in the last 7 days. Practice of the target skill can be started from the title screen, and completing the quest requires 3 first-try correct answers in that skill. This condition differs from the 1 problem that removes the rust itself.

Progress is added during play, and completion is announced at the top edge of the screen. Review also counts toward the shared finish, first-try and combo conditions. Completing all 3 gives 1 hammer, only 1 time that day, and marks the Calendar. If you already hold the maximum, only the effect plays; the reward is not carried over to a later day.

### 7.4 Trophies

306 trophies are defined in 12 categories and 39 series. The categories are Keep it up, Hard work, Skills, Growth, Extra, Combo, Accuracy, Dopa, Review, Grades, Collection and Secret. A trophy is earned by reaching a step of its series, and trophies once earned are kept.

Trophies are checked at the results, the final results, the title screen and so on; the trophy dialog is never opened during play. One notification shows up to 6 trophies plus the number of remaining ones. When trophies are checked for the first time against existing records, everything already reached is announced together.

The list can be filtered with "All" / "Earned" / "Not yet", and opening a series shows all its steps, the dates earned and the rewards. "Almost" shows the 12 trophies closest to their next condition, excluding secret, Dopa and one-off conditions. The ranks are Bronze, Silver, Gold and Rainbow: a single-step series is Gold, the last step of a multi-step series is Rainbow, and secrets have their own display.

In the current normal play, the number of finished by-grade plays is not passed to the lifetime statistics, so the 18 "Play Grade N" trophies do not progress. Likewise, the values needed for the secrets "14 problems with no wrong answer", "5 or more Extra problems with no wrong answer" and "Sunday" are never updated. These are still included in the number of trophies defined in the list. The remaining secrets are January 1, coming back after 7 or more days away, and finishing a play in all 4 regular modes (My Level, by grade, Practice and Review).

The lifetime play time adds up only the elapsed time of finished basic sets and does not include Extra time. The "Time played" trophies also use this value.

The thresholds of each series are as follows. Numeric metrics are achieved at or above the threshold. Grade and branch completion and the secrets are each independent conditions.

| Category: series | Thresholds or independent conditions |
| --- | --- |
| Keep it up: Play days in a row | 3, 5, 7, 10, 14, 21, 30, 50, 75, 100, 150, 200, 365 |
| Keep it up: Days played | 1, 3, 5, 7, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300, 365, 500, 730, 1000 |
| Keep it up: Login stickers | 1, 7, 14, 30, 50, 100, 200, 365 |
| Keep it up: Crown stickers | 1, 3, 5, 10, 20, 52 |
| Hard work: Problems solved | 10, 30, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000, 7500, 10000, 20000, 30000, 50000, 100000 |
| Hard work: Digits entered | 100, 500, 1000, 3000, 5000, 10000, 30000, 50000, 100000, 300000 |
| Hard work: Times played | 1, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000 |
| Hard work: Time played | 10, 30, 60, 120, 300, 600, 1200, 3000 (minutes) |
| Skills: Skills unlocked | 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 58 |
| Skills: Skills mastered | 1, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 58 |
| Skills: Master a whole grade | Grade 1 mastered, Grade 2 mastered, Grade 3 mastered, Grade 4 mastered, Grade 5 mastered, Grade 6 mastered |
| Skills: Master a whole branch | Add & subtract: all mastered, Multiply & divide: all mastered, Decimals & fractions: all mastered, Other: all mastered |
| Extra: Reach Extra | 1, 3, 5, 10, 20, 30, 50, 100, 200, 300 |
| Extra: Best single Extra | 3, 5, 7, 10, 12, 15, 18, 20, 23, 25, 30 |
| Extra: Solved in Extra | 10, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000 |
| Combo: Combo | 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 300 |
| Accuracy: Flawless finish | 1, 3, 5, 10, 20, 30, 50, 100, 200, 300 |
| Accuracy: Right on the first try | 10, 50, 100, 300, 500, 1000, 3000, 5000, 10000, 30000 |
| Dopa: Dopa | 2, 3, 4, 5, 6, 7, 8, 9 (common logarithm; the trophies read "100 Dopa" through "1 billion Dopa") |
| Review: Review | 1, 5, 10, 30, 50, 100, 200, 300 |
| Grades: Play Grade 1 | 1, 10, 30 |
| Grades: Play Grade 2 | 1, 10, 30 |
| Grades: Play Grade 3 | 1, 10, 30 |
| Grades: Play Grade 4 | 1, 10, 30 |
| Grades: Play Grade 5 | 1, 10, 30 |
| Grades: Play Grade 6 | 1, 10, 30 |
| Secret: Secret | Perfect 14, Clean Extra, Sunday math, New Year drill, Welcome back!, Every way to play |
| Keep it up: Quests complete | 1, 3, 7, 14, 30, 50, 100, 200, 365 |
| Keep it up: Quest streak | 2, 3, 5, 7, 14, 30 |
| Keep it up: Streak Hammer | 1, 3, 10 |
| Skills: Stars | 5, 10, 25, 50, 75, 100, 150, 200, 250, 290 |
| Skills: ☆5 skills | 1, 3, 5, 10, 20, 30, 58 |
| Skills: Whole grade at ☆3 | Grade 1 all ☆3, Grade 2 all ☆3, Grade 3 all ☆3, Grade 4 all ☆3, Grade 5 all ☆3, Grade 6 all ☆3 |
| Growth: Polish off rust | 1, 3, 5, 10, 30, 50 |
| Growth: Time capsules | 1, 3, 5, 10, 30 |
| Growth: Faster than back then | 1, 5, 10 |
| Growth: You improved! | 1, 5, 10, 30, 50, 100 |
| Collection: Collection | 10, 20, 30, 40, 47 |
| Collection: Full sets | 1, 3, 5, 8 |

### 7.5 Compared with before

On the basic results, up to 3 lines under "You improved!" show where you did better than in earlier records for the same skill. Both this play and the comparison need 3 or more problems. The comparisons are the previous day played, the most recent day at least 21 days ago, and the first 3 problems ever solved. Earlier plays from the same day are not used as a comparison.

Answer times are compared as averages per answer cell and are shown as seconds per problem, converted using this play's average number of cells. Items where the time dropped by 10% or more, or the first-try rate improved by 10 percentage points or more, are candidates. Each skill contributes its 1 largest improvement, and these are shown with the largest improvements first overall. If nothing improved, nothing is shown. The skill check, the demo and the testing URLs that stop growth records are excluded.

### 7.6 Time capsule

From the first 3 problems saved for each skill, the oldest unused problem is chosen among those whose skill is mastered and for which `30 × 86400000` ms or more have passed since it was solved.

When the basic set of regular My Level, by-grade or Practice play has 4 or more problems, the problem at 0-based position `max(1, min(N−2, floor(N/2)))` is replaced. The skill check, Review, Extra, the demo and the testing URLs that stop growth records are excluded. There is at most 1 per day: the date is saved when the intro finishes, so even if play is interrupted after that, it is not offered again on the same day. The problem becomes used when it is completed.

An envelope intro and an orange border make it clear that this is a problem from the past. For the comparison, if this time is less than 0.95 times the old time, the time saved is shown; otherwise, a drop in the number of wrong answers is shown; if neither applies, it shows that you solved it again, together with the date. A reduction of exactly 5% is not shown as faster.

### 7.7 Collection and unlocking effects

There are 47 items in 8 categories. Each category has 1 item available from the start, and the remaining 39 are rewards for specific trophies. Items not yet unlocked show how to get them.

| Category | Items and unlock conditions (trophy names, except for starter items) |
| --- | --- |
| Background (6 items) | Sunburst (starter), Night sky (3-day streak), Sea & bubbles (Solve 100), Festival (15 days played), Paper craft (Solve 200), Outer space (Extra 10 times) |
| Correct mark (5 items) | Flower circle (starter), Correct stamp (Play 3 times), Medal (7-day streak), Crown (3 flawless runs), Firework ring (30 combo) |
| Confetti (6 items) | Paper confetti (starter), Music notes (3 days played), Petals (7 stickers), Numbers (1,000 digits), Bubbles (Review 10), Candy (10 in one Extra) |
| Music (5 items) | Marimba March (starter), 8-bit (Play 10 times), Festival drums (5-day streak), Brass band (5 days played), Electro (Extra 3 times) |
| Outfit (9 items) | None (starter), Cap (First day), Headband (Solve 50), Cape (20 combo), Round glasses (100 first tries), Ribbon (14 stickers), Crown (14-day streak), Wizard hat (First ☆5 skill), Headphones (1 capsule) |
| Dopakichi's color (8 items) | Pink (starter), Blue (Play 5 times), Green (7 days played), Snow white (7 quest days), Yellow (Solve 300), Purple (100 Extra problems), Gold (30-day streak), Rainbow (100 days played) |
| Crowd (4 items) | Color mix (starter), Dressed-up crowd (50 first tries), Rainbow crowd (30 days played), Matching crowd (100 stars) |
| Finale (4 items) | Giant Dopakichi (starter), Fireworks show (Extra 5 times), Parade (10-day streak), Rocket (Extra 20 times) |

For each category, you either fix an item or choose "Shuffle". Shuffle picks from the items you own at the start of each play, and the title screen uses the basic look. The choices are saved and do not affect the score or the difficulty of the problems.

On the Collection screen, you can try out backgrounds, marks, particles, outfits, colors, crowds and finales. Songs play a 7-second preview. Outfits and colors are layered onto Dopakichi's original shape, and the chosen look is also used for the crowd and the finale.

## 8. Dopakichi, effects and sound

Dopakichi is nonverbal as a rule. The design reference is `docs/dopakichi.svg`. Dopakichi has large ears sticking out sideways, a wide round head, a cream-colored face and belly, double-circle eyes, thin arms and blue feet. The base colors are pink `#FF97BF`, cream `#FFF3E4`, inner ear `#FFE6F0`, blue `#2F79F7` and outline `#000000`.

Each entered digit is carried in a free hand. The left and right hands can carry different digits, and judging is kept separate from carrying, so the next input never has to wait. Intermediate and final correct answers get jumps, clapping, spins and so on; on a wrong answer, Dopakichi collapses and then recovers. There are 10 wrong-answer acts: early on one is chosen from 4, midway from 8, and at intensity 0.6 or higher from all 10, avoiding a repeat of the previous one.

With `i` the 0-based basic problem number and `N` the number of problems, the effect intensity is `E = 0.08 + 0.92 × (i/(N−1))^1.3`. With only 1 problem, `E = 1`. In Extra, for `k` completed problems, `tier = floor(k/3)` and `E = 1 + min(0.5, tier × 0.1)`.

Depending on the intensity, the background, correct marks such as the flower circle, confetti, stars, fireworks and coins, the crowd, marching, the reach effect ("LAST DIGIT!"), lights and shaking are layered on. The finale is one of Giant Dopakichi, Fireworks show, Rocket and Parade, and at the end it shows 100 points (the "100 pts" stamp). The layout of the input and the number pad, and the place-value alignment of column calculations, are preserved.

Music and sound effects are synthesized with the Web Audio API; no external recorded audio is loaded. There are 5 songs: the basic Marimba March plus 8-bit, Festival drums, Brass band and Electro. Using oscillators, noise, filters, reverb and so on, percussion, bass, chords and melody are layered in stages.

The basic tempo is `112 + min(1, E) × 16` BPM: normally 113.28 BPM at the start and 128 BPM at the end. On the last problem, the key is raised 2 semitones above the base. Extra is `134 + tier × 5` BPM, in a key `2 + min(tier, 5)` semitones above the base. The key change has an upper limit, but this formula puts no fixed upper limit on the tempo.

Key presses, digits landing, correct and wrong answers, Dopa milestones, the clock and so on are reinforced with sound, with pitches that follow the song's chords. Audio starts with the user interaction that browsers require. The background uses WebGL and falls back to a CSS background when WebGL is unavailable or the context is lost.

## 9. Settings and accessibility

| Setting | Contents and default |
| --- | --- |
| Language | The globe menu at the top of Settings: English or 日本語 (Japanese). Default English. Choosing Japanese opens the original game in `ja/`, and choosing English there comes back. The choice is remembered on the device apart from the game data, so resetting all data keeps it |
| Number of problems | 6, 10 or 14. Default 10 |
| Sound | On / off. Default on. Can also be changed with the mute button on the play screen |
| Volume | 0–100%. Default 80% |
| Motion | 0–100%. If not set, 0% when the device asks for reduced motion, otherwise 100% |
| Demo play | Shows 1 round of automatic play |
| Reset everything | Resets the data on the device after 2 confirmations |

Motion affects the amount of particles, shaking, flashes, the background, the crowd and Dopakichi's big movements. At 0%, the main movements, shaking and flashes stop, and the guide also uses still poses. However, it does not stop all rendering: some processing remains, such as the idle breathing motion on normal screens and a small number of particles. Changing the value lets you try out the response on the Settings screen. Answer judging and the scoring rules do not change.

Escape closes an open dialog or, on any screen other than the title, opens the "Back to the title?" confirmation, as does the round back button at the top left of the play screen (hidden during demo play, which any tap already ends). The stay button ("Keep playing" during play, "Stay here" elsewhere) has the initial focus, and while the confirmation is open, input, the basic elapsed time, the Extra and combo deadlines and per-problem timing are stopped. Mastery and other progress from the problems completed before quitting is kept. If you quit before the basic results, no finished-play history entry is created. Escape during the demo ends the demo.

Accessible names for buttons, visible focus, labels for anything other than digits, and focus cycling within the guide are provided. Full play with a screen reader alone, or usability on every device, is not guaranteed.

At heights of 700px or less, the problem sheet, the effects area and the margins are adjusted so that everything down to the bottom row of the number pad fits on the screen. Keys stay 48px tall even on short screens. On narrow screens, big one-line texts (cut-ins, Dopa milestones and finale stamps) shrink to fit.

The 1st full-reset confirmation, "Reset everything", shows what will be erased, and the 2nd, "Really erase everything?", confirms that it cannot be undone. In both, "Cancel" has the initial focus. Canceling, pressing Escape or tapping the background does not erase anything. Confirming the 2nd one deletes every storage key with the prefix `dopa-drill`, discards the in-memory cache and reloads. Unrelated keys are kept.

The reset covers settings, history, mastery, stars, growth records, trophies, collection choices, stickers, quests, items and the first-run guide state. On restart, the first-run guide, the starting items and so on are created again. If the browser refuses the deletion, the process still does not end with an exception, but erasure of the saved data cannot be guaranteed.

## 10. Storage and privacy

Data is stored in the browser's localStorage under the key `dopa-drill:v1`, with data version 1. There are no fields for entering personal information such as names, and the app does not send learning records to any server. There are no ads, external analytics, rankings or cross-device sync. The game runs by fetching its static files from the hosting server.

If storage is unavailable, reading fails or the JSON is corrupted, the game starts in its initial state, and if saving fails, the game in progress continues. Records do not carry over when browser data is cleared, when storage is restricted, or when the game is used in another browser or from another origin.

| Record | Contents and limits |
| --- | --- |
| Settings and guide | Number of problems, sound, volume, motion, guide shown |
| Finished-play history | Up to 3000 entries. Date, mode, score, correct, Oops, basic time, Dopa, Extra |
| Skills | First-try results of the last 6 problems, the last 24 signatures, time, cell count, wrong answers and date of the last 30 problems, aggregates for the last 60 days, the first 3 problems themselves, time of the last first-try correct answer and of mastery, stars |
| Review | The problems themselves, up to 40 |
| Lifetime statistics | Completed problems, cells, first-try correct and wrong answers, finished basic sets and modes, basic time, best Dopa, Extra, best combo, Review, days played, times polished, comparisons and capsules |
| Continuity and rewards | Stickers, login days, saved days, hammers, quests, earned trophies, effect choices |

The answer time for 1 problem runs from when input is accepted until the last correct input, excluding the effects between problems and confirmation dialogs. The lifetime problem, cell and wrong-answer counts are added when a problem is completed, so actions on unfinished problems abandoned partway are not counted.

For saved data that has no statistics yet, the values that can be obtained from the history are initialized from it. Values that the history cannot tell, such as past cell counts and the best combo, are measured from 0. The testing URLs do not stop saving as a whole; the specific differences are described in the next section.

## 11. Technical structure, running and testing

### 11.1 File structure

The game is implemented as ES Modules with no library dependencies, and the app needs no build step. It runs from static hosting and needs no server-side computation.

The original Japanese game is published at [dopa-drill.tanosix.com](https://dopa-drill.tanosix.com/), which serves only the product files with Cloudflare Workers Static Assets. `Cache-Control: no-transform` in `app/_headers` stops analytics scripts from being injected automatically at delivery.

| File or directory | Role |
| --- | --- |
| `app/en/index.html`, `app/en/style.css` | Screens and styles |
| `app/en/js/main.js` | Coordinates game flow, input, screens and effects |
| `app/en/js/guide.js` | First-run guide and help, placement of the guide elements |
| `app/en/js/skills.js`, `app/en/js/problems.js` | Skill definitions, problem generation, input steps |
| `app/en/js/session.js` | Problem planning, mastery, stars, rust, time capsule |
| `app/en/js/scoring.js`, `app/en/js/growth.js` | Score, Dopa and combo; growth statistics and comparisons |
| `app/en/js/quests.js`, `app/en/js/trophies.js`, `app/en/js/unlocks.js` | Quests, achievements, effects catalog |
| `app/en/js/store.js` | Storage, history, login, hammer, reset |
| `app/en/js/dopakichi.js` | The mascot as an SVG split into parts, and its acting |
| `app/en/js/fx.js`, `app/en/js/bg.js` | Canvas 2D particles and WebGL background |
| `app/en/js/audio.js`, `app/en/js/core.js` | Web Audio synthesis; clock, interpolation and springs |
| `app/en/fonts/` | Local subsets of Dela Gothic One and Zen Maru Gothic (the same families as the original), re-subset for the English text. SIL Open Font License |
| `app/ja/` | The original Japanese game, unchanged apart from the language menu, the play screen's back button and fonts with the two characters of 言語 added. It shares the save data with the English version |
| `tests/` | Tests for problem generation, judging, storage, growth and more |
| `tools/build_fonts.sh` | Regenerates the font subsets when the on-screen text changes |
| `docs/` | This document, the curriculum, Dopakichi design reference |

### 11.2 Running and testing

From the repository root, you can serve the files statically with a command such as the following. Open `/app/` at the server address shown. Because ES Modules are used, serve the files over HTTP instead of opening the HTML file directly.

```sh
python3 -m http.server 8000 --bind 0.0.0.0
```

Run the tests, which use Node.js, with the following command.

```sh
node --test tests/*.test.mjs
```

The product tests are 59 tests in the 11 files `tests/app_*.test.mjs`. The command above also runs other bundled tests, so the total count varies by distribution. In Node.js environments that report counts only per file, adding `--experimental-test-isolation=none` (where supported) lets the individual tests be counted.

The tests check problem generation and input steps, scoring, storage and reset, skills and stars, problem planning, growth comparisons, quests, trophies, unlockable effects and the guide's layout calculations. Passing the automated tests does not replace checking the rendering, sound quality and feel on real devices.

### 11.3 Testing URL parameters

Specify them like `/app/?count=6&seed=123`.

| Parameter | Behavior |
| --- | --- |
| `count=6`, `count=10`, `count=14` | Selects the number of problems at startup |
| `lang=en`, `lang=ja` | `lang=en` stays in English and `lang=ja` opens the Japanese version, without changing the saved choice |
| `seed=<number>` | Fixes the random numbers used for problem selection, generation and so on. Does not fix the random numbers of every visual effect |
| `extra=<seconds>` | Replaces Extra's default 90 seconds. The 900ms added at the start still applies |
| `skill=<skill ID>` | Replaces normal problem selection with that skill. When combined with Review or the fixed template, the selection logic's order of precedence applies |
| `demo` | Starts the fixed-template basic set from the My Level entry point. The first problem is 27 + 35. No automatic play |
| `capture` | A testing path that collects sound events. Suppresses the normal live audio output, the automatic guide, title-screen reward notifications and so on |

Plays with `skill` or the fixed template stop the normal answer timing, growth statistics and quests, but the finished-play history and Review are still saved. With `skill`, when the problem plan is the skill check, that plan's mastery grants and the saving of check completion also take effect. Trophy checks stop with `skill` and `capture`, but not with `demo` alone. Even with `capture`, normal progress, history and statistics continue to be saved. Do not treat these as a way to practice without leaving records.

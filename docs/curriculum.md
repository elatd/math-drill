# Japanese Math Drill — Calculation Scope and Skill List

This document describes the calculations that Japanese Math Drill currently poses, the prerequisite relationships between skills, the conditions under which problems are generated, and how answers are entered. The numbers may change with future tuning. For the rules of the game as a whole, see `docs/SPEC.md`; for the skill definitions, `app/en/js/skills.js`; and for problem generation, `app/en/js/problems.js`.

## 1. Scope and structure

The app covers calculations that are answered by typing digits, organized into 58 skills assigned to Grades 1–6 (the grades of Japanese elementary school). It covers the four arithmetic operations and column calculation, decimals and fractions, rounding, factors and multiples, order of operations, percentages, equal ratios, and finding the value of a letter (x). It does not include geometry, measurement (length, liquid volume, time and so on), graphs, word problems, or answers entered as kanji numerals or into place-value charts.

The grades show where this app places each skill; they do not cover every unit in Japanese textbooks. Do not guess what a skill asks from its name alone; read the conditions in the list together with the descriptions of the generators.

| Grade | Number of skills | Main topics |
| --- | --- | --- |
| 1 | 8 | Number bonds for 10, carrying and borrowing, calculations with 3 numbers, simple 2-digit addition and subtraction |
| 2 | 13 | Column addition and subtraction with 2 digits and simple 3 digits, times tables, tens × 1-digit, 1/2 and 1/4 of a number |
| 3 | 14 | 3- and 4-digit addition and subtraction, column multiplication of whole numbers, division and remainders, adding and subtracting decimals to tenths, fractions with like denominators |
| 4 | 10 | Long division of whole numbers, order of operations, rounding (round half up), adding and subtracting decimals to hundredths, multiplying and dividing decimals by whole numbers, mixed numbers |
| 5 | 8 | Multiplying and dividing decimals by decimals, greatest common factor and least common multiple, simplifying fractions, fractions with unlike denominators, fractions and whole numbers, percentages |
| 6 | 5 | Multiplying and dividing fractions by fractions, multiplying decimals by fractions, equal ratios, the value of x |

The lanes are "Add & subtract", "Multiply & divide", "Decimals & fractions" and "Other". On screen, each lane is split into 2 columns. Skills that are vertically adjacent are not necessarily prerequisites of one another.

## 2. Skill list

The skills below are listed in the order in which they are defined in the code. Each row gives the ID, the name shown on screen, the lane, all prerequisites, and the generator with its parameters. The names are the English ones; the Japanese version shows the original Japanese names, from `app/ja/js/skills.js`. "None" in the prerequisites column marks a skill that is unlocked from the start.

In the parameters, `[min,max]` is an integer range that includes both ends. `dans` and `dens` are arrays of candidates to pick from (`dans` lists times tables, *dan* being the Japanese word for one times table; `dens` lists denominators). `da` and `db` are the numbers of digits of the operands, `dd` and `ds` the numbers of digits of the dividend and the divisor, and `pa` and `pb` the numbers of decimal places. Because candidates are further filtered by the conditions, not every combination within a range actually appears.

### Grade 1

| ID | Name | Lane | Prerequisites (all required) | Generator and parameters |
| --- | --- | --- | --- | --- |
| `g1-compose10` | Making 10 | Add & subtract | None | `compose` `{"total":10}` |
| `g1-add-nc` | 1-digit addition | Add & subtract | None | `hadd` `{"a":[1,9],"b":[1,9],"carry":"none"}` |
| `g1-sub-nb` | Subtract within 10 | Add & subtract | `g1-add-nc` | `hsub` `{"a":[2,10],"b":[1,9],"borrow":"none"}` |
| `g1-add-c` | Add with carrying | Add & subtract | `g1-compose10`, `g1-add-nc` | `hadd` `{"a":[2,9],"b":[2,9],"carry":"yes"}` |
| `g1-sub-b` | Subtract with borrowing | Add & subtract | `g1-add-c`, `g1-sub-nb` | `hsub` `{"a":[11,18],"b":[2,9],"borrow":"yes"}` |
| `g1-add3` | Three numbers | Add & subtract | `g1-sub-b` | `add3` `{}` |
| `g1-add-2d1` | 2-digit + 1-digit | Add & subtract | `g1-add-c` | `hadd` `{"a":[11,89],"b":[1,9],"carry":"none","tensToo":true}` |
| `g1-sub-2d1` | 2-digit − 1-digit | Add & subtract | `g1-sub-b`, `g1-add-2d1` | `hsub` `{"a":[11,99],"b":[1,9],"borrow":"none","tensToo":true}` |

### Grade 2

| ID | Name | Lane | Prerequisites (all required) | Generator and parameters |
| --- | --- | --- | --- | --- |
| `g2-vadd2-nc` | 2-digit column addition | Add & subtract | `g1-add-2d1` | `vadd` `{"da":2,"db":2,"carry":"none","maxDigits":2}` |
| `g2-vadd2-c` | Carrying in columns | Add & subtract | `g2-vadd2-nc`, `g1-add-c` | `vadd` `{"da":2,"db":[1,2],"carry":"some","maxDigits":2}` |
| `g2-vsub2-nb` | 2-digit column subtraction | Add & subtract | `g1-sub-2d1` | `vsub` `{"da":2,"db":2,"borrow":"none"}` |
| `g2-vsub2-b` | Borrowing in columns | Add & subtract | `g2-vsub2-nb`, `g1-sub-b` | `vsub` `{"da":2,"db":[1,2],"borrow":"some"}` |
| `g2-vadd3s` | Adding past 100 | Add & subtract | `g2-vadd2-c` | `vadd` `{"da":2,"db":2,"carry":"many","maxDigits":3}` |
| `g2-vsub3s` | Subtract from 100s | Add & subtract | `g2-vsub2-b`, `g2-vadd3s` | `vsub` `{"da":3,"db":2,"borrow":"some","aMax":199}` |
| `g2-kuku25` | 5 & 2 times tables | Multiply & divide | `g1-add-c` | `kuku` `{"dans":[5,2]}` |
| `g2-kuku34` | 3 & 4 times tables | Multiply & divide | `g2-kuku25` | `kuku` `{"dans":[3,4]}` |
| `g2-kuku67` | 6 & 7 times tables | Multiply & divide | `g2-kuku34` | `kuku` `{"dans":[6,7]}` |
| `g2-kuku891` | 8, 9 & 1 times tables | Multiply & divide | `g2-kuku67` | `kuku` `{"dans":[8,9,1]}` |
| `g2-kuku-mix` | Mixed times tables | Multiply & divide | `g2-kuku891` | `kuku` `{"dans":[1,2,3,4,5,6,7,8,9]}` |
| `g2-mul-tens` | Tens × 1-digit | Multiply & divide | `g2-kuku-mix` | `mulTens` `{}` |
| `g2-frac-of` | 1/2 and 1/4 | Decimals & fractions | `g2-kuku25` | `fracOf` `{"dens":[2,4]}` |

### Grade 3

| ID | Name | Lane | Prerequisites (all required) | Generator and parameters |
| --- | --- | --- | --- | --- |
| `g3-vadd3` | 3-digit addition | Add & subtract | `g2-vadd3s` | `vadd` `{"da":3,"db":3,"carry":"some","maxDigits":3}` |
| `g3-vsub3` | 3-digit subtraction | Add & subtract | `g2-vsub3s` | `vsub` `{"da":3,"db":[2,3],"borrow":"some"}` |
| `g3-vadd4` | 4-digit addition | Add & subtract | `g3-vadd3` | `vadd` `{"da":4,"db":[3,4],"carry":"many","maxDigits":4}` |
| `g3-vsub4` | 4-digit subtraction | Add & subtract | `g3-vsub3` | `vsub` `{"da":4,"db":[3,4],"borrow":"zero"}` |
| `g3-div-basic` | Division | Multiply & divide | `g2-kuku-mix` | `div` `{"exact":true}` |
| `g3-div-rem` | Division with remainders | Multiply & divide | `g3-div-basic` | `divRem` `{}` |
| `g3-div-tens` | Tens ÷ 1-digit | Multiply & divide | `g3-div-basic` | `divTens` `{}` |
| `g3-vmul-2x1` | 2-digit × 1-digit | Multiply & divide | `g2-mul-tens` | `vmul` `{"da":2,"db":1}` |
| `g3-vmul-3x1` | 3-digit × 1-digit | Multiply & divide | `g3-vmul-2x1` | `vmul` `{"da":3,"db":1}` |
| `g3-vmul-2x2` | 2-digit × 2-digit | Multiply & divide | `g3-vmul-2x1` | `vmul` `{"da":2,"db":2}` |
| `g3-vmul-3x2` | 3-digit × 2-digit | Multiply & divide | `g3-vmul-2x2`, `g3-vmul-3x1` | `vmul` `{"da":3,"db":2}` |
| `g3-dec-add1` | Decimal addition | Decimals & fractions | `g2-vadd2-c` | `vdec` `{"op":"add","places":1}` |
| `g3-dec-sub1` | Decimal subtraction | Decimals & fractions | `g3-dec-add1`, `g2-vsub2-b` | `vdec` `{"op":"sub","places":1}` |
| `g3-frac-same` | Fractions: + and − | Decimals & fractions | `g2-frac-of` | `frac` `{"op":"addsub","same":true,"maxOne":true}` |

### Grade 4

| ID | Name | Lane | Prerequisites (all required) | Generator and parameters |
| --- | --- | --- | --- | --- |
| `g4-vdiv-2d1` | 2-digit ÷ 1-digit | Multiply & divide | `g3-div-rem`, `g3-div-tens` | `vdiv` `{"dd":2,"ds":1}` |
| `g4-vdiv-3d1` | 3-digit ÷ 1-digit | Multiply & divide | `g4-vdiv-2d1` | `vdiv` `{"dd":3,"ds":1}` |
| `g4-vdiv-2d2` | 2-digit ÷ 2-digit | Multiply & divide | `g4-vdiv-2d1`, `g3-vmul-2x1` | `vdiv` `{"dd":2,"ds":2}` |
| `g4-vdiv-3d2` | 3-digit ÷ 2-digit | Multiply & divide | `g4-vdiv-2d2`, `g4-vdiv-3d1` | `vdiv` `{"dd":3,"ds":2}` |
| `g4-order` | Order of operations | Other | `g2-kuku-mix`, `g2-vsub2-b` | `order` `{}` |
| `g4-round` | Rounding | Other | `g3-vadd4` | `round` `{}` |
| `g4-dec-add2` | Decimals to hundredths | Decimals & fractions | `g3-dec-sub1` | `vdec` `{"op":"addsub","places":2}` |
| `g4-dec-mul` | Decimal × whole number | Decimals & fractions | `g4-dec-add2`, `g3-vmul-2x1` | `vmul` `{"da":2,"db":1,"pa":1}` |
| `g4-dec-div` | Decimal ÷ whole number | Decimals & fractions | `g4-dec-mul`, `g4-vdiv-2d1` | `decDivInt` `{}` |
| `g4-frac-mixed` | Mixed numbers: + and − | Decimals & fractions | `g3-frac-same` | `frac` `{"op":"addsub","same":true,"mixed":true}` |

### Grade 5

| ID | Name | Lane | Prerequisites (all required) | Generator and parameters |
| --- | --- | --- | --- | --- |
| `g5-dec-mul` | Decimal × decimal | Decimals & fractions | `g4-dec-mul` | `vmul` `{"da":2,"db":2,"pa":1,"pb":1}` |
| `g5-dec-div` | Decimal ÷ decimal | Decimals & fractions | `g4-dec-div`, `g5-dec-mul` | `decDivDec` `{}` |
| `g5-gcd` | Greatest common factor | Other | `g3-div-basic` | `gcdlcm` `{"kind":"gcd"}` |
| `g5-lcm` | Least common multiple | Other | `g5-gcd` | `gcdlcm` `{"kind":"lcm"}` |
| `g5-frac-reduce` | Simplify fractions | Decimals & fractions | `g5-gcd`, `g4-frac-mixed` | `frac` `{"op":"reduce"}` |
| `g5-frac-diff` | Unlike fractions | Decimals & fractions | `g5-frac-reduce`, `g5-lcm` | `frac` `{"op":"addsub","same":false}` |
| `g5-frac-int` | Fractions × ÷ whole numbers | Decimals & fractions | `g5-frac-reduce` | `frac` `{"op":"muldivInt"}` |
| `g5-percent` | Percent of a number | Other | `g4-dec-mul` | `percent` `{}` |

### Grade 6

| ID | Name | Lane | Prerequisites (all required) | Generator and parameters |
| --- | --- | --- | --- | --- |
| `g6-frac-mul` | Fraction × fraction | Decimals & fractions | `g5-frac-int` | `frac` `{"op":"mul"}` |
| `g6-frac-div` | Fraction ÷ fraction | Decimals & fractions | `g6-frac-mul` | `frac` `{"op":"div"}` |
| `g6-frac-dec` | Decimals & fractions | Decimals & fractions | `g6-frac-div`, `g5-dec-div` | `frac` `{"op":"decimal"}` |
| `g6-ratio` | Equal ratios | Other | `g5-lcm` | `ratio` `{}` |
| `g6-letter` | Find x | Other | `g4-order` | `letter` `{}` |

## 3. Conditions for generating problems

### 3.1 Horizontal whole-number calculations

`compose` splits 10 into a number from 1 to 9 and the rest (shown as "10 is 3 and [7]"; square brackets mark the cells the player fills in). In `hadd`, `carry: none` means no carrying and `yes` means at least 1 carry. In `hsub`, the number being subtracted is always smaller than the number it is subtracted from; `borrow: none` means no borrowing and `yes` means at least 1 borrow.

With `tensToo: true`, in addition to the usual 2-digit and 1-digit calculations, the generator produces addition or subtraction of two multiples of ten when a random draw is below 0.3. For addition, it pairs a multiple of 10 from 10 to 80 with a positive multiple of 10 that keeps the sum at 90 or less; for subtraction, it takes a multiple of 10 from 20 to 90 and subtracts a smaller positive multiple of 10. As a result, the skills named "2-digit + 1-digit" and "2-digit − 1-digit" also contain problems in which both numbers have 2 digits.

`add3` uses 3 whole numbers from 1 to 9 and makes each operation an addition with probability 0.6 and a subtraction otherwise. The result of the first operation is 0 or more, and the final result is from 0 to 20. `kuku` (from the Japanese *kuku*, the times tables) multiplies a number from the specified times tables by a number from 1 to 9. `mulTens` is the product of a multiple of 10 from 10 to 90 and a number from 2 to 9.

`fracOf` builds the original whole number from a denominator of 2 or 4 and an answer from 1 to 9 (shown as "1/4 of 12 = [3]"). `div` gives exact divisions with a divisor from 2 to 9 and a quotient from 1 to 9. `divRem` takes a quotient and a divisor from the same ranges and adds a remainder from 1 up to one less than the divisor (the answer is written with "R", as in 17 ÷ 5 = 3 R 2).

`divTens` has 2 kinds of problems. It generates a multiple of ten divided by a 1-digit number with a quotient that is also a multiple of ten, and 2-digit problems whose tens digit and ones digit are each divisible by the divisor. So even though the skill is named "Tens ÷ 1-digit", the ones digit of the dividend is sometimes not 0.

### 3.2 Whole-number column calculations

For addition, `carry: some` means at least 1 carry and `many` at least 2. The number of digits of the result is limited to `maxDigits` or fewer. "Adding past 100" is set up as two 2-digit numbers with 2 or more carries.

For subtraction, the number being subtracted is smaller than the number it is subtracted from, and `borrow: some` means at least 1 borrow. "Subtract from 100s" subtracts a 2-digit number from a number from 100 to 199. `borrow: zero` accepts a problem that has at least 2 borrows and, in addition, either borrows across a 0 or, failing that, passes an extra random draw below 0.3. So not every 4-digit subtraction borrows across a 0.

For multiplication, the number of digits of each number is specified. A 1-digit multiplier is from 2 to 9, the ones digit of the multiplicand is never 0, and the ones digit of a 2-digit multiplier is also never 0. In decimal multiplication, products whose last digit is 0 and products less than 1 are excluded.

In division, a 1-digit divisor is from 2 to 9 and a 2-digit divisor is from 11 to 49. The dividend has the specified number of digits and is at least 2 times the divisor. In 2-digit ÷ 2-digit, the quotient has 1 digit. Both problems with a remainder and problems that divide exactly appear.

### 3.3 Decimals

`vdec` builds column addition and subtraction using the numbers scaled up to whole numbers. `places: 1` works to the tenths place and `places: 2` to the hundredths place; with the latter, only the second term is given to the tenths place, with probability 0.4. Operands and results whose decimal part ends in 0 are excluded, and subtraction results are positive.

`decDivInt` gives problems with a divisor from 2 to 9 and a quotient to the tenths place from 1.1 to 9.9, excluding quotients that end in 0. `decDivDec` builds problems from a divisor from 0.2 to 0.9 or from 1.1 to 2.9 and a whole-number quotient from 2 to 9. At present, the answers to "Decimal ÷ decimal" are whole numbers. Both are answered horizontally; no intermediate long-division steps are entered.

Problems that mix decimals and fractions are only multiplications of one of 0.2, 0.4, 0.5, 0.6 and 0.8 by a proper fraction in simplest form. Mixed addition, subtraction and division are not generated.

### 3.4 Fractions

With like denominators, the denominator is from 3 to 12. Grade 3 addition and subtraction accept only results that are positive and less than 1; despite the name `maxOne: true`, exactly 1 is excluded. The original denominator is kept, and even when the result could be simplified, the answer is that numerator and denominator as they are, without simplifying.

For mixed numbers, the whole-number part of the first term is from 1 to 4, that of the second term from 0 to 3, and the numerators are from 1 to one less than the denominator. A combination is accepted when the result is positive, is not a whole number, and has a fractional part in simplest form. If the result is 1 or more, it is entered as a mixed number, including its whole-number part (written "2 1/3" in text).

Simplifying problems are made by multiplying the numerator and denominator of a proper fraction in simplest form (denominator 2 to 9) by the same whole number from 2 to 6. Addition and subtraction with unlike denominators use two proper fractions in simplest form with different denominators from 2 to 9, limit the least common multiple to 36 or less and the result to a positive value less than 1, and simplify the result.

Multiplying and dividing a fraction by a whole number uses a proper fraction in simplest form with a denominator from 2 to 9 and a whole number from 2 to 9. Multiplying and dividing a fraction by a fraction uses fractions in simplest form with denominators from 2 to 9 and numerators from 1 to 9, excludes results that are whole numbers, and keeps the numerator and denominator after simplifying at 99 or less. Results greater than 1 are given as mixed numbers.

### 3.5 Other calculations

`order` has 4 forms: `a＋b×c`, `a×(b＋c)`, `(a−b)×c` and `x−b×c`. a, b and c are from 2 to 9, and x in the last form is a whole number 1 to 30 greater than the product. The result is positive and at most 999. At present this generator includes no division.

`round` rounds a number from 1001 to 99999 (round half up) to the nearest 10, 100 or 1000, choosing a place that suits the number of digits of the original number (shown on three lines as "Round 34567" / "to the nearest 100" / "→ [34600]"). Problems in which the result would have more digits than the original number are excluded. `gcdlcm` uses 2 numbers made by multiplying a common factor from 2 to 9 by 1 to 6, both 4 or more and different from each other, and asks for their greatest common factor (GCF) or least common multiple (LCM), with an answer from 2 to 99 (shown on two lines, as in "GCF of 12 and 18" / "= [6]").

In `percent`, the base number is one of 20, 40, 50, 60, 80, 100, 200, 300, 400 and 500, and the percentage is one of 5, 10, 20, 25, 30, 40, 50, 60 and 75%. Only combinations whose result is a positive whole number are used (shown as "25 % of 200 = [50]").

`ratio` simplifies a ratio of two different numbers from 1 to 9, multiplies both of its terms by 2 to 9 to make an equal ratio, and leaves one term of that ratio blank. There is no separate format that asks for the value of a ratio (a ÷ b). `letter` uses the forms `x×a=b`, `x＋a=b` and `x−a=b`, and the answer is the value of x.

### 3.6 Avoiding repeats

A problem's title and expression form its signature, and generation avoids the signatures of each skill's last 24 problems and those already used in the current play. It generates up to 40 times and, if it cannot avoid a repeat, uses the last candidate. This does not guarantee a set number of problems without repeats, even in skills with few possible problems. Review and time capsules reuse saved problems exactly as they were.

## 4. Mastery, unlocking and modes

The usual mastery condition is to solve at least 6 problems and to complete at least 5 of the last 6 without a wrong answer, including in the intermediate entries. A skill is unlocked when all of its prerequisite skills are mastered. A single wrong answer never takes mastery away. The conditions for stars, rust and erasing a skill's records after mastery are described in the specification for the game as a whole.

The first My Level play (the skill check) tests the skills, sorted by grade and by depth of prerequisites, skipping ahead as it goes. Because a tested skill answered right on the first try is mastered at once together with its prerequisites, this differs from the usual condition of solving 6 problems in each skill.

By-grade play ("Grade 1" to "Grade 6") draws problems from the selected grade regardless of what is unlocked, and switches to the next grade from the 7th Extra problem on. In Grade 6 it stays in the same grade. Practice uses the chosen skill for the basic problems. A time capsule whose conditions are met may replace 1 problem, even when its skill is outside the range of by-grade play or Practice.

## 5. Input and hints

Horizontal answers are entered 1 digit at a time from the left. Column addition, subtraction and multiplication proceed from the lowest place (in addition and subtraction the steps are labeled "Ones place", "Tens place" and so on), and long division proceeds from the highest place of the quotient. Long division goes in the order quotient digit ("Quotient: tens place" and so on), remainder of the intermediate subtraction ("Subtract"), next quotient digit; the products and the digits brought down are shown automatically. In horizontal division with a remainder, the quotient is entered first, then the remainder (written with "R", as in 3 R 2).

Fractions are entered denominator first, then numerator (the steps are labeled "Denominator" and "Numerator"); for a mixed number, the whole-number part ("Whole number") is entered before them. Decimal points and the small helper digits for carrying and borrowing are shown automatically. Answers are checked cell by cell against the digit string prepared when the problem was generated; equivalent expressions or other forms of the same fraction are not accepted.

When wrong answers are repeated in the same cell, the digits to look at are highlighted and a hint is shown. Hints are intermediate expressions, ways of breaking numbers apart, times tables, the common denominator and the like (for example "Make 10: 8 + 2", "7s: 7 14 21 …" or "Common denominator: 12"), and may include the value of a calculation result.

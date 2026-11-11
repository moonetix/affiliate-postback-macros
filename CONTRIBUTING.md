# Contributing

This sheet is only as good as its sources. One rule covers most of it: **every value you add or change needs a link to the vendor's own public documentation, read the month you submit.**

## What counts as a source

- A page on the vendor's own domain (help center, developer docs, API reference) that loads without a login.
- Not a blog post, forum thread, screenshot, partner email, or an integration you saw working. If the docs do not state it, it stays out, or goes under `not_documented`.

## How to change the data

1. Edit [data/macros.json](data/macros.json). Never edit the tables in README.md by hand.
2. Put the source URL on every macro and fact you touch, and set `checked` on the entry to the current month (`YYYY-MM`).
3. Run the build and the tests with Node.js 22:

   ```sh
   node scripts/build.mjs
   npm test
   ```

4. Commit `data/macros.json` and the updated `README.md` together.

## Pull request checklist

- One platform per pull request when you can.
- The description lists each changed value with its source link.
- Quote the vendor's wording where a value is easy to misread, such as a status code or a signed field list.
- If you work for the vendor, say so. Corrections from vendors are welcome under the same sourcing rule.

## Style

US English, short sentences, no emoji, and a plain hyphen instead of en or em dashes. The build fails on dashes and emoji.

By contributing you agree that your contribution is released under the [MIT License](LICENSE).

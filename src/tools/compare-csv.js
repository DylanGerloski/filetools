'use strict';

module.exports = {
  slug: 'compare-csv',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-15',
  navLabel: 'Compare CSV Files',
  h1: 'Compare Two CSV Files',
  title: 'Compare Two CSV Files (Diff) - In Your Browser | filetools',
  metaDescription: 'Compare two CSV files free, cell by cell, with no upload and no sign-up. Added, removed, and changed rows are highlighted, even when row order differs.',
  deck: 'Drop two CSV files and see exactly what changed, cell by cell - added rows, removed rows, and edited values, all highlighted. Pick a unique column and reordered rows still match up correctly. Nothing is uploaded.',
  clientEntry: 'csvDiff',
  // Registration fragment -- see pdf-merge.js's comment above its own
  // `family` field for what these mean and how they're assembled.
  family: 'csv',
  mark: { verb: 'compare', ink: 'csv' },
  maxBytes: 20 * 1024 * 1024,
  mode: 'compare-csv',
  fileTypeLabel: 'CSV',
  accepts: '.csv,text/csv',
  multiple: true,
  howSteps: [
    'Choose or drop exactly two .csv files together - the first becomes “File A” (the original), the second “File B” (the changed version). Use the “Swap A ↔ B” button if you picked them in the wrong order.',
    'If a column has a unique value in every row (an ID, an email, an order number), it’s auto-detected as the match key, so rows still line up correctly even if their order changed between the two files. Override it under “Match rows by” if the wrong one was picked, or force plain row-position comparison.',
    'Review the highlighted table: added rows, removed rows, and changed rows (with the specific old → new cell values shown). Then download a status-tagged CSV of the full comparison.',
  ],
  faqs: [
    {
      q: 'What happens if the rows are in a different order in each file?',
      answerHtml: 'If any column has a unique value in every row of both files (an ID column is the common case), it’s auto-detected and used to match rows by VALUE instead of position - so a row that moved is still recognized as the same row, not reported as removed-and-re-added. Without a unique column, rows are compared by position using the same alignment algorithm behind line-by-line text diffs: it correctly finds the longest run of untouched rows and reports only what actually changed around them, but a fully shuffled set of otherwise-identical rows (with no unique column) will show as removed and re-added, the same limitation ordinary text diff tools have.',
    },
    {
      q: 'How does it tell a "changed" row from a "removed" row plus an "added" row?',
      answerHtml: 'With a key column, this is exact: the same key means the same row, so any cell difference between the two is a "changed" row. Without a key column (comparing by position), a deleted row directly next to an inserted row is reported as one "changed" row only if enough of its cells still match - otherwise they’re unrelated content that happened to land next to each other, and showing them as separate removed/added rows is the more honest read.',
    },
    {
      q: 'Is my data sent anywhere?',
      answerHtml: 'No. Both files are read and compared entirely on your device. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'Is there a size limit?',
      answerHtml: 'Each file is capped at a generous size (shown on the drop zone) so a single huge file can’t freeze the tab. Separately, comparing by row position uses an algorithm whose work grows with both files’ row counts multiplied together, so extremely large files (roughly two files each in the low thousands of rows or more) may be refused for position-based comparison with a message pointing you at the key-column option instead - matching by a unique column has no such limit.',
    },
    {
      q: 'What’s in the downloaded diff.csv?',
      answerHtml: 'Every row from the comparison (unchanged rows included, regardless of the on-page "show unchanged rows" toggle) with a "Status" column (Unchanged/Changed/Added/Removed) and, for any cell that changed, both values shown as "old → new" in that cell.',
    },
    {
      q: 'How are quoted fields with commas or embedded line breaks handled?',
      answerHtml: 'Correctly - this tool reads both files with a full CSV parser, so a quoted field like <code>"Smith, John"</code>, or one containing its own line break, is read as one field, not split apart.',
    },
    {
      q: 'Is the comparison case-sensitive and whitespace-sensitive by default?',
      answerHtml: 'Case-sensitive by default ("Rent" and "rent" count as different) and whitespace-sensitive by default (a leading/trailing space counts as a change) - both are toggles above the table if you want the comparison to ignore either.',
    },
  ],
  relatedSlugs: ['merge-csv', 'sort-lines', 'remove-duplicate-lines'],
};

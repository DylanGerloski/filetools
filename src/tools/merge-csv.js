'use strict';

module.exports = {
  slug: 'merge-csv',
  category: 'data',
  // See pdf-merge.js's launchDate comment for what reads this and when to
  // set it.
  launchDate: '2026-08-15',
  navLabel: 'Merge CSV Files',
  h1: 'Merge Multiple CSV Files',
  title: 'Merge CSV Files Free - In Your Browser | filetools',
  metaDescription: 'Combine two or more CSV files into one, free, with no upload and no sign-up. Columns with slightly different names still line up correctly.',
  deck: 'Drop two or more CSV files and download them combined into one - mismatched columns line up by name, with blanks filled in rather than data shifted into the wrong column. Nothing is uploaded.',
  clientEntry: 'csvMerge',
  mode: 'merge-csv',
  fileTypeLabel: 'CSV',
  accepts: '.csv,text/csv',
  multiple: true,
  howSteps: [
    'Choose or drop two or more .csv files.',
    'Review the preview - each file’s row count and any column differences are listed above the table.',
    'Turn on “Each file has a header row” (on by default) so columns line up by name even if the files aren’t in the same order, or turn it off to merge purely by position.',
    'Download the merged CSV.',
  ],
  faqs: [
    {
      q: 'What happens if my files don’t have exactly the same columns?',
      answerHtml: 'With “Each file has a header row” on (the default), columns are matched by their header name across every file. The merged file’s columns are the union of every file’s columns - a file missing a column gets a blank cell there instead of its other values shifting into the wrong column. Any file that adds a column not seen before, or is missing one another file has, is called out in the summary above the table.',
    },
    {
      q: 'Is the column name matching case-sensitive?',
      answerHtml: 'Yes - <code>Email</code> and <code>email</code> are treated as two different columns, not merged together. This is deliberate: guessing that two similarly-named columns are actually the same one risks silently combining data that only looks related. Rename a header in one file first if you want two differently-cased columns to line up.',
    },
    {
      q: 'What does turning off “Each file has a header row” do?',
      answerHtml: 'It merges every row purely by position instead of by column name - column 1 from every file lines up together, column 2 with column 2, and so on, with blank cells added to pad out any row shorter than the widest one. Use this for files with no header row at all; for files whose headers are in a different order, leave the header option on instead.',
    },
    {
      q: 'Is there a limit on how many files or rows I can merge?',
      answerHtml: 'No fixed limit - everything runs in your browser rather than on a server, so the only real ceiling is your device’s own memory. Each file is capped at a generous size (shown on the drop zone) so a single huge file can’t freeze the tab.',
    },
    {
      q: 'Do you upload my files anywhere?',
      answerHtml: 'No. Every file is read and merged entirely on your device. Turn off your Wi-Fi after the page loads and it still works.',
    },
    {
      q: 'What order do the merged rows end up in?',
      answerHtml: 'Files are merged in the order you chose or dropped them, and each file’s own row order is preserved within that. Turn on “Add a Source file column” to keep track of which row came from which file after merging.',
    },
    {
      q: 'How are quoted fields with commas or line breaks inside them handled?',
      answerHtml: 'Correctly - this tool reads the whole file with a full CSV parser, so a quoted field like <code>"Smith, John"</code> or a quoted field containing its own line break is read as one field, not split apart. The one thing not handled is a body row with MORE fields than that file’s own header row - the extra fields are dropped, since there’s no column for them to land in.',
    },
  ],
  relatedSlugs: ['sort-lines', 'remove-duplicate-lines', 'compare-csv'],
};

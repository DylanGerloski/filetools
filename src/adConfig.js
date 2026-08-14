'use strict';

// Ad configuration. `enabled` stays false until the human creates real
// manual ad units in AdSense and supplies the slot ids -- that's a real
// account/dashboard action, not something a build does on its own. With
// enabled:false, src/ads.js renders the same reserved-height placeholder
// with no <ins>/push script, so local builds, visual-QA screenshots, and
// Lighthouse runs stay deterministic and ad-free until a human flips this
// on. The Auto ads loader script (src/shell.js) is unconditional and
// already uses the human's existing, approved publisher id -- it is a
// separate mechanism from the manual slots this file gates. Same publisher
// id already in use by the two live sibling assets.
module.exports = {
  enabled: false,
  client: 'ca-pub-9767914878112531',
  slots: {
    inContent: null,
    footer: null,
  },
};

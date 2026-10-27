# Motion sweep verification

## #42: Wishlist row exit experiment — rejected

Tested the proposed `ViewTransition exit="row-out" default="none"` and
150ms `route-out` rule in Chromium with two released Wishlist games.
Moving Celeste to Backlog also animated the document root:

```text
-ua-view-transition-fade-out: ::view-transition-old(root)
route-out: ::view-transition-old(_t_0_)
```

The surrounding page crossfaded, including the header and remaining row.
Slowing the browser animations made the page-wide snapshot visible.
This fails the issue's explicit “whole page flickers or crossfades” criterion.
Both experimental edits were removed; the #41 notice entrance remains.
No replacement mechanism or sibling-row animation was added.

The experimental build passed all 24 browser tests and 146 unit tests;
behavioral tests alone do not establish whether this motion feels clean.

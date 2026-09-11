# Original extraction screen

This run used the extractor before `restoreBaseline` was added. Its exact source is retained in `sources/spatial.js`. Final repeat `../spatial-v2/` used the explicit restore API with the same protocol and produced identical input and raw/delta snapshot hashes. The two large identical binary files here are relative symbolic links to that repeat, preserving both reports without duplicate storage. The original direction-confound failure is retained.

Use the final run for the current replay script; it verifies current source identity as well as evidence hashes.

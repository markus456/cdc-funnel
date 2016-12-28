# Example visualization client 

This is a very simple example that shows how the streamed data could be
used. This client expects that the database has the table `test.t1` with the
following definition.

```
CREATE TABLE test.t1 (x INT, y INT)
```

Any changes to this table are visualized with green dots for insertions, red
dots for deletions, grey dots for values that were updated and purple for the
updated values.

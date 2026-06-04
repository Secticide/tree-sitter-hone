; Indentation rules for Zed.

; Indent inside braces for blocks, structs, enums, impl, mod
[
  (block)
  (struct_def)
  (enum_def)
  (extern_union_def)
  (impl_block)
  (mod_block)
  (match_stmt)
  (param_list)
  (arg_list)
  (array_expr)
] @indent

; Dedent on the closing brace / bracket / paren
[
  "}"
  ")"
  "]"
] @dedent

; Hone syntax highlighting queries for Zed.
; Capture names follow the Zed/tree-sitter-highlight convention.

; ── Keywords ─────────────────────────────────────────────────────────────────

[
  "fn"
  "extern"
  "return"
  "let"
  "mut"
  "pub"
  "mod"
  "use"
  "impl"
  "struct"
  "enum"
  "union"
  "type"
  "if"
  "else"
  "while"
  "for"
  "in"
  "match"
  "break"
  "continue"
  "defer"
  "as"
  "and"
  "or"
  "not"
] @keyword

; ── Special value keywords ────────────────────────────────────────────────────

[ "true" "false" ] @boolean
"null"        @constant.builtin
"uninit"      @constant.builtin
"self"        @variable.special
"Self"        @type.builtin
"void"        @type.builtin
"unreachable" @keyword.control

; ── Compiler builtins ─────────────────────────────────────────────────────────

[
  "#if"
  "#inline"
  "#noinline"
] @keyword.directive

[
  "#sizeof"
  "#alignof"
  "#likely"
  "#unlikely"
  "#fence"
] @function.builtin

; ── Primitive types ───────────────────────────────────────────────────────────

(primitive_type) @type.builtin

; ── Comments ──────────────────────────────────────────────────────────────────

(line_comment)  @comment
(block_comment) @comment

; ── Literals ──────────────────────────────────────────────────────────────────

(integer_literal) @number
(float_literal)   @number.float
(bool_literal)    @boolean
(null_literal)    @constant.builtin
(uninit_literal)  @constant.builtin
(string_literal)  @string
(cstring_literal) @string
(char_literal)    @character

; ── Declarations ──────────────────────────────────────────────────────────────

(function_def  name: (identifier) @function)
(extern_fn     name: (identifier) @function)
(struct_def    name: (identifier) @type)
(enum_def      name: (identifier) @type)
(extern_union_def name: (identifier) @type)
(impl_block    name: (identifier) @type)
(type_alias    name: (identifier) @type)

; Module names
(mod_block name: (identifier) @namespace)
(mod_decl  name: (identifier) @namespace)

; Use paths
(use_decl (path (identifier) @namespace))

; ── Parameters ────────────────────────────────────────────────────────────────

(named_param name: (identifier) @variable.parameter)
(self_param "self" @variable.special)

; Type parameters
(type_param name: (identifier) @type)

; ── Struct / enum members ─────────────────────────────────────────────────────

(struct_field name: (identifier) @property)
(enum_variant name: (identifier) @constant)

; ── Field access ──────────────────────────────────────────────────────────────

(field_expr  field: (identifier) @property)
(field_init  name:  (identifier) @property)
(field_pattern name: (identifier) @property)

; ── Function calls ────────────────────────────────────────────────────────────

(call_expr   callee: (identifier) @function.call)
(method_call_expr method: (identifier) @function.method.call)

; ── Paths ─────────────────────────────────────────────────────────────────────

; `Mod::item` — qualifier is a namespace, name is the called entity
(path_expr   qualifier: (identifier) @namespace)
(path_expr   name: (identifier) @function.call)

; Enum variant construction in struct literal
(struct_literal qualifier: (identifier) @type)
(struct_literal name: (identifier) @constant)

; Patterns
(path_pattern   qualifier: (identifier) @type)
(path_pattern   name: (identifier) @constant)
(struct_pattern enum_name: (identifier) @type)
(struct_pattern variant: (identifier) @constant)

; ── Operators ─────────────────────────────────────────────────────────────────

[
  "=" "+=" "-=" "*=" "/=" "%="
  "&=" "|=" "^=" "<<=" ">>="
] @operator

[
  "+" "-" "*" "/" "%" "+%" "-%" "*%"
  "==" "!=" "<" "<=" ">" ">="
  "&" "|" "^" "~" "<<" ">>"
  "->" "=>"
  "::"
] @operator

[ "." ".." "..." ] @punctuation.delimiter
[ "," ";" ":" ]   @punctuation.delimiter
[ "(" ")" "[" "]" "{" "}" ] @punctuation.bracket

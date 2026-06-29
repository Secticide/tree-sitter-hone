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
  "intern"
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
"self"             @variable.special
(self_type)        @type.builtin
(void_type)        @type.builtin
(meta_type)        @type.builtin
(unreachable_expr) @keyword.control

; ── Compiler builtins ─────────────────────────────────────────────────────────

[
  "#if"
  "#inline"
  "#noinline"
  "#noalias"
] @keyword.directive

[
  "#sizeof"
  "#alignof"
  "#sqrt"
  "#abs"
  "#floor"
  "#ceil"
  "#round"
  "#likely"
  "#unlikely"
  "#atomic_load"
  "#atomic_store"
  "#atomic_xchg"
  "#atomic_add"
  "#atomic_sub"
  "#atomic_and"
  "#atomic_or"
  "#atomic_xor"
  "#atomic_min"
  "#atomic_max"
  "#atomic_umin"
  "#atomic_umax"
  "#atomic_cmpxchg"
  "#atomic_cmpxchg_weak"
] @function.builtin

(fence_stmt "#fence" @function.builtin)

[
  "#print"
  "#println"
  "#eprint"
  "#eprintln"
] @function.builtin

(print_stmt format: (string_literal) @string)

(keep_stmt "#keep" @function.builtin)

; ── Primitive types ───────────────────────────────────────────────────────────

(primitive_type) @type.builtin

; ── Named / generic type references ──────────────────────────────────────────

(named_type) @type
(generic_type name: (identifier) @type)

; ── Comments ──────────────────────────────────────────────────────────────────

(line_comment)  @comment
(block_comment) @comment

; ── Literals ──────────────────────────────────────────────────────────────────

(integer_literal)    @number
(float_literal)      @number.float
(bool_literal)       @boolean
(null_literal)       @constant.builtin
(uninit_literal)     @constant.builtin
(string_literal)     @string
(raw_string_literal) @string
(cstring_literal)    @string
(char_literal)       @string

; ── Declarations ──────────────────────────────────────────────────────────────

(function_def  name: (identifier) @function)
(extern_fn     name: (identifier) @function)
(struct_def    name: (identifier) @type)
(enum_def      name: (identifier) @type)
(extern_union_def name: (identifier) @type)
(impl_block    name: (identifier) @type)
(impl_block    name: (generic_type name: (identifier) @type))
(impl_const    name: (identifier) @constant)
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

(struct_field  name: (identifier) @property)
(enum_variant  name: (identifier) @constant)

; ── Field access ──────────────────────────────────────────────────────────────

(field_expr  field: (identifier) @property)
(field_init  name:  (identifier) @property)
(field_pattern name: (identifier) @property)

; ── Function calls ────────────────────────────────────────────────────────────

(call_expr callee: (callee_expr (identifier) @function.call))
(method_call_expr method: (identifier) @function.method.call)

; ── Paths ─────────────────────────────────────────────────────────────────────

; `Mod::item` — plain qualifier
(path_expr qualifier: (identifier) @namespace)
(path_expr name: (identifier) @function.call)

; `Enum(T)::item` — generic qualifier; qualifier is a call_expr, callee is the type name
(path_expr qualifier: (call_expr callee: (callee_expr (identifier) @type)))

; `pkg::mod::item` — nested path qualifier
(path_expr qualifier: (path_expr name: (identifier) @namespace))

; ── Type paths ────────────────────────────────────────────────────────────────

; `module::Type` — path_type qualifier and name
(path_type qualifier: (identifier) @namespace)
(path_type qualifier: (path_type name: (identifier) @namespace))
(path_type name: (identifier) @type)

; `module::Generic(T)` — generic_type with path_type name
(generic_type name: (path_type name: (identifier) @type))
(generic_type name: (path_type qualifier: (identifier) @namespace))

; ── Struct literal construction ───────────────────────────────────────────────

; Enum variant construction in struct literal — plain qualifier
(struct_literal qualifier: (identifier) @type)
(struct_literal name: (identifier) @constant)

; Enum variant construction — generic qualifier (call_expr, e.g. Option(i32)::Variant)
(struct_literal qualifier: (call_expr callee: (callee_expr (identifier) @type)))

; Enum variant construction — deep path qualifier: `pkg::Enum::Variant { }`
(struct_literal qualifier: (path_expr name: (identifier) @type))

; ── Patterns ──────────────────────────────────────────────────────────────────

; Patterns — plain qualifier
(path_pattern   qualifier: (identifier) @type)
(path_pattern   name: (identifier) @constant)
(struct_pattern enum_name: (identifier) @type)
(struct_pattern variant: (identifier) @constant)

; Patterns — generic qualifier
(path_pattern   qualifier: (generic_type name: (identifier) @type))
(struct_pattern enum_name: (generic_type name: (identifier) @type))

; Patterns — deep path qualifier: `pkg::Enum::Variant`
(path_pattern   qualifier: (path_type name: (identifier) @type))
(struct_pattern enum_name: (path_type name: (identifier) @type))

; ── Operators ─────────────────────────────────────────────────────────────────

[
  "=" "+=" "-=" "*=" "/=" "%="
  "&=" "|=" "^=" "<<=" ">>="
] @operator

[
  "+" "-" "*" "/" "%" "+%" "-%" "*%"
  "==" "!=" "<" "<=" ">" ">="
  "&" "|" "^" "~" "<<" ">>"
  "=>"
  "::"
] @operator

[ "." ".." ] @punctuation.delimiter
[ "," ";" ":" ]   @punctuation.delimiter
[ "(" ")" "[" "]" "{" "}" ] @punctuation.bracket

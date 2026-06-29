// Tree-sitter grammar for the Hone programming language.
// Targets Zed editor via the tree-sitter query files in queries/.
//
// Nested block comments (/* /* */ */) are a Hone feature that tree-sitter
// cannot express with a pure regex token. The regex here handles the common
// case; a future external scanner can fix it if it becomes a problem.

const PREC = {
  ASSIGN:  1,
  OR:      2,
  AND:     3,
  COMPARE: 4,
  BITOR:   5,
  BITXOR:  6,
  BITAND:  7,
  SHIFT:   8,
  ADD:     9,
  MUL:    10,
  UNARY:  11,
  CAST:   12,
  CALL:   13,
};

module.exports = grammar({
  name: 'hone',

  extras: $ => [/\s/, $.line_comment, $.block_comment],

  word: $ => $.identifier,

  conflicts: $ => [
    // `expr.name(` is ambiguous: field_expr followed by call vs method_call_expr.
    [$.method_call_expr, $.field_expr],
    // `Type(T)::Name` — `Type(T)` is parsed as call_expr but is also the qualifier
    // for a generic-qualified path_expr or struct_literal.  GLR resolves via `::`.
    [$.call_expr, $.path_expr],
    [$.call_expr, $.struct_literal],
    // `Name(T)` at `identifier •(`: callee_expr vs struct_literal name+type_args.
    // GLR explores both; `{` body confirms struct_literal, otherwise call wins.
    [$.callee_expr, $.struct_literal],
    // `fn(...) •  token` — optional return type: token may start a type (shift) or
    // be part of the enclosing expression (reduce).  GLR resolves by context.
    [$.fn_ptr_type],
    [$.extern_fn_ptr_type],
    // `[]` is ambiguous: empty array_expr vs start of slice_type `[]T`.
    // GLR resolves by what follows (`;` / `,` / operator → array_expr; type → slice_type).
    [$.slice_type, $.array_expr],
  ],

  rules: {

    source_file: $ => repeat($._item),

    // ── Comments ─────────────────────────────────────────────────────────

    line_comment: $ => token(seq('//', /.*/)),

    block_comment: $ => token(seq(
      '/*',
      /[^*]*\*+([^/*][^*]*\*+)*/,
      '/',
    )),

    // ── Identifiers ──────────────────────────────────────────────────────

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,

    // ── Top-level items ──────────────────────────────────────────────────

    _item: $ => choice(
      $.function_def,
      $.extern_fn,
      $.struct_def,
      $.enum_def,
      $.extern_union_def,
      $.impl_block,
      $.mod_block,
      $.mod_decl,
      $.use_decl,
      $.type_alias,
      $.global_let,
      $.hash_if_item,
    ),

    // ── Functions ────────────────────────────────────────────────────────

    function_def: $ => seq(
      optional(choice('pub', 'intern')),
      optional(choice('#inline', '#noinline')),
      'fn',
      field('name', $.identifier),
      field('params', $.param_list),
      optional(field('return_type', $._type)),
      field('body', $.block),
    ),

    extern_fn: $ => seq(
      optional(choice('pub', 'intern')),
      'extern',
      'fn',
      field('name', $.identifier),
      field('params', $.param_list),
      optional(field('return_type', $._type)),
      choice(';', field('body', $.block)),
    ),

    param_list: $ => seq(
      '(',
      optional(seq(
        $._param,
        repeat(seq(',', $._param)),
        optional(','),
      )),
      ')',
    ),

    _param: $ => choice($.self_param, $.named_param, $.variadic_param),

    self_param: $ => seq(
      choice('&', seq('&', 'mut')),
      'self',
    ),

    named_param: $ => seq(
      optional('#noalias'),
      field('name', $.identifier),
      ':',
      field('type', $._type),
    ),

    variadic_param: $ => '...',

    // ── Struct ───────────────────────────────────────────────────────────

    struct_def: $ => seq(
      optional(choice('pub', 'intern')),
      'struct',
      field('name', $.identifier),
      optional(field('type_params', $.type_param_list)),
      '{',
      repeat($.struct_field),
      '}',
    ),

    type_param_list: $ => seq(
      '(',
      $.type_param,
      repeat(seq(',', $.type_param)),
      optional(','),
      ')',
    ),

    type_param: $ => seq(
      field('name', $.identifier),
      ':',
      $.meta_type,
    ),

    struct_field: $ => seq(
      optional('pub'),
      field('name', $.identifier),
      ':',
      field('type', $._type),
      optional(','),
    ),

    // ── Enum ─────────────────────────────────────────────────────────────

    enum_def: $ => seq(
      optional(choice('pub', 'intern')),
      'enum',
      // Optional explicit backing type: `enum(u8) Name { ... }`
      optional(seq('(', field('repr', $._type), ')')),
      field('name', $.identifier),
      optional(field('type_params', $.type_param_list)),
      '{',
      repeat($.enum_variant),
      '}',
    ),

    enum_variant: $ => seq(
      field('name', $.identifier),
      choice(
        // Data variant: `Circle { radius: f32, center: Point }` — comma-separated,
        // no trailing comma required (unlike struct definition fields).
        seq(
          '{',
          optional(seq(
            $.enum_data_field,
            repeat(seq(',', $.enum_data_field)),
            optional(','),
          )),
          '}',
        ),
        // Unit variant: `Red,` or `Red = 3,` or `Neg = -1,`
        optional(seq('=', field('value', choice($.integer_literal, seq('-', $.integer_literal))))),
      ),
      optional(','),
    ),

    // Fields inside an enum data variant — comma-separated, no trailing comma required.
    enum_data_field: $ => seq(
      field('name', $.identifier),
      ':',
      field('type', $._type),
    ),

    // ── Extern union ─────────────────────────────────────────────────────

    extern_union_def: $ => seq(
      optional(choice('pub', 'intern')),
      'extern',
      'union',
      field('name', $.identifier),
      '{',
      repeat($.struct_field),
      '}',
    ),

    // ── Impl ─────────────────────────────────────────────────────────────

    // `impl Name { ... }` or `impl Name(T) { ... }` (generic impl).
    // The name is a plain identifier or a generic_type like `Pair(T)`.
    impl_block: $ => seq(
      optional(choice('pub', 'intern')),
      'impl',
      field('name', choice($.identifier, $.generic_type)),
      '{',
      repeat(choice($.function_def, $.impl_const)),
      '}',
    ),

    // `let FOO: Type = const_expr;` inside an impl block.
    impl_const: $ => seq(
      optional(choice('pub', 'intern')),
      'let',
      field('name', $.identifier),
      ':',
      field('type', $._type),
      '=',
      field('value', $._rval),
      ';',
    ),

    // ── Modules ──────────────────────────────────────────────────────────

    mod_block: $ => seq(
      optional(choice('pub', 'intern')),
      'mod',
      field('name', $.identifier),
      '{',
      repeat($._item),
      '}',
    ),

    mod_decl: $ => seq(
      optional(choice('pub', 'intern')),
      'mod',
      field('name', $.identifier),
      ';',
    ),

    // ── Use ──────────────────────────────────────────────────────────────

    use_decl: $ => seq(optional(choice('pub', 'intern')), 'use', $.path, ';'),

    // ── Type alias ───────────────────────────────────────────────────────

    type_alias: $ => seq(
      optional(choice('pub', 'intern')),
      'type',
      field('name', $.identifier),
      '=',
      field('type', $._type),
      ';',
    ),

    // ── Global let ───────────────────────────────────────────────────────

    global_let: $ => seq(
      optional(choice('pub', 'intern')),
      'let',
      optional('mut'),
      field('name', $.identifier),
      ':',
      field('type', $._type),
      '=',
      field('value', $._rval),
      ';',
    ),

    // ── Compile-time #if at item level ───────────────────────────────────

    hash_if_item: $ => seq(
      '#if',
      field('cond', $._expr),
      '{', repeat($._item), '}',
      optional(seq('else', '{', repeat($._item), '}')),
    ),

    // ── Types ────────────────────────────────────────────────────────────

    _type: $ => choice(
      $.primitive_type,
      $.self_type,
      $.void_type,
      $.meta_type,
      $.fn_ptr_type,
      $.extern_fn_ptr_type,
      $.pointer_type,
      $.ref_type,
      $.array_type,
      $.slice_type,
      $.path_type,
      $.generic_type,
      $.named_type,
    ),

    primitive_type: $ => choice(
      'i8', 'i16', 'i32', 'i64',
      'u8', 'u16', 'u32', 'u64',
      'f32', 'f64',
      'bool', 'char',
    ),

    self_type: $ => 'Self',
    void_type: $ => 'void',

    // The `type` keyword used as a type in generic parameters: `T: type`.
    meta_type: $ => 'type',

    // `fn(T1, T2) R` — native function pointer type
    fn_ptr_type: $ => seq(
      'fn',
      '(',
      optional(seq(
        $._type,
        repeat(seq(',', $._type)),
        optional(','),
      )),
      ')',
      optional($._type),
    ),

    // `extern fn(T1, T2) R` — C-ABI function pointer type
    extern_fn_ptr_type: $ => seq(
      'extern',
      'fn',
      '(',
      optional(seq(
        $._type,
        repeat(seq(',', $._type)),
        optional(','),
      )),
      ')',
      optional($._type),
    ),

    pointer_type: $ => prec(PREC.UNARY, seq('*', optional('mut'), $._type)),
    ref_type: $ => prec(PREC.UNARY, seq('&', optional('mut'), $._type)),

    // `[N]T` or `[_]T` (inferred size uses identifier `_` in size position)
    array_type: $ => seq('[', field('size', $._expr), ']', field('element', $._type)),
    slice_type: $ => seq('[', ']', optional('mut'), field('element', $._type)),

    generic_type: $ => prec(1, seq(
      field('name', choice($.identifier, $.path_type)),
      '(',
      $._type,
      repeat(seq(',', $._type)),
      optional(','),
      ')',
    )),

    named_type: $ => $.identifier,

    // `module::Type` or `a::b::c::Type` — module-qualified type name.
    // Left-recursive: qualifier can itself be a path_type for 3+ levels.
    path_type: $ => prec.left(1, seq(
      field('qualifier', choice($.identifier, $.path_type)),
      '::',
      field('name', $.identifier),
    )),

    // ── Statements ───────────────────────────────────────────────────────

    _stmt: $ => choice(
      $.let_stmt,
      $.return_stmt,
      $.break_stmt,
      $.continue_stmt,
      $.defer_stmt,
      $.fence_stmt,
      $.if_stmt,
      $.if_let_stmt,
      $.while_stmt,
      $.while_let_stmt,
      $.for_stmt,
      $.match_stmt,
      $.cond_match_stmt,
      $.print_stmt,
      $.keep_stmt,
      $.atomic_store_stmt,
      $.hash_if_stmt,
      $.block,
      $.expr_stmt,
    ),

    let_stmt: $ => seq(
      'let',
      optional('mut'),
      field('name', $.identifier),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('value', $._rval))),
      choice(
        // let-else: the else block diverges, so no trailing ';' is required.
        seq('else', field('else_body', choice($.block, $.unreachable_expr)), optional(';')),
        ';',
      ),
    ),

    return_stmt: $ => seq('return', optional($._rval), ';'),
    break_stmt:    $ => seq('break', ';'),
    continue_stmt: $ => seq('continue', ';'),

    fence_stmt: $ => seq(
      '#fence',
      optional(seq('(', field('ordering', $.identifier), ')')),
      ';',
    ),

    defer_stmt: $ => seq('defer', $._stmt),

    if_stmt: $ => prec.right(seq(
      optional(choice('#likely', '#unlikely')),
      'if',
      field('cond', $._expr),
      field('then', $.block),
      optional(seq('else', field('else', choice($.if_stmt, $.block)))),
    )),

    // `if let [mut] pattern = expr { then } [else { else }]`
    // Covers both null-check (`if let [mut] name = ptr`) and variant forms.
    if_let_stmt: $ => prec.right(seq(
      optional(choice('#likely', '#unlikely')),
      'if',
      'let',
      optional('mut'),
      field('pattern', $._pattern),
      '=',
      field('cond', $._expr),
      field('then', $.block),
      optional(seq('else', field('else', choice($.if_let_stmt, $.if_stmt, $.block)))),
    )),

    while_stmt: $ => seq(
      'while',
      field('cond', $._expr),
      field('body', $.block),
    ),

    // `while let [mut] pattern = expr { body }`
    while_let_stmt: $ => seq(
      'while',
      'let',
      optional('mut'),
      field('pattern', $._pattern),
      '=',
      field('iter', $._expr),
      field('body', $.block),
    ),

    for_stmt: $ => seq(
      'for',
      optional('mut'),
      field('var', $.identifier),
      ':',
      field('var_type', $._type),
      'in',
      field('iter', $._expr),
      field('body', $.block),
    ),

    match_stmt: $ => seq(
      'match',
      field('scrutinee', $._expr),
      '{',
      repeat($.match_arm),
      '}',
    ),

    match_arm: $ => seq(
      field('pattern', $._pattern),
      '=>',
      field('body', $.block),
    ),

    // `match { cond => { } ... }` — condition match without a scrutinee.
    // Each arm condition is a boolean expression; `_` is the wildcard fallthrough.
    cond_match_stmt: $ => seq(
      'match',
      '{',
      repeat($.cond_match_arm),
      '}',
    ),

    cond_match_arm: $ => seq(
      field('cond', $._expr),
      '=>',
      field('body', $.block),
    ),

    // `#print("fmt", args...)` and friends — formatted output builtins.
    print_stmt: $ => seq(
      choice('#print', '#println', '#eprint', '#eprintln'),
      '(',
      field('format', $.string_literal),
      repeat(seq(',', $._rval)),
      optional(','),
      ')',
      ';',
    ),

    // `#keep(expr)` — prevent the optimiser from eliminating a variable.
    keep_stmt: $ => seq('#keep', '(', $._expr, ')', ';'),

    hash_if_stmt: $ => prec.right(seq(
      '#if',
      field('cond', $._expr),
      field('then', $.block),
      optional(seq('else', field('else', choice($.hash_if_stmt, $.block)))),
    )),

    block: $ => seq('{', repeat($._stmt), '}'),

    expr_stmt: $ => seq($._expr, ';'),

    // ── Patterns ─────────────────────────────────────────────────────────

    _pattern: $ => choice(
      $.wildcard,
      $.or_pattern,
      $.struct_pattern,
      $.literal_pattern,
      $.path_pattern,
    ),

    wildcard: $ => '_',

    or_pattern: $ => prec.left(1, seq(
      $._pattern,
      repeat1(seq('|', $._pattern)),
    )),

    // `Variant { field }` or `Enum::Variant { field }` or `pkg::Enum::Variant { field }`
    struct_pattern: $ => seq(
      optional(seq(field('enum_name', choice($.identifier, $.generic_type, $.path_type)), '::')),
      field('variant', $.identifier),
      '{',
      optional(seq(
        $.field_pattern,
        repeat(seq(',', $.field_pattern)),
        optional(','),
      )),
      '}',
    ),

    field_pattern: $ => seq(
      field('name', $.identifier),
      optional(seq(':', field('alias', $.identifier))),
    ),

    literal_pattern: $ => choice(
      $.integer_literal,
      $.float_literal,
      $.bool_literal,
      $.char_literal,
      $.string_literal,
    ),

    // `Name`, `Qualifier::Name`, `Qualifier(T)::Name`, or `pkg::Enum::Variant`
    path_pattern: $ => seq(
      optional(seq(field('qualifier', choice($.identifier, $.generic_type, $.path_type)), '::')),
      field('name', $.identifier),
    ),

    // ── Expressions ──────────────────────────────────────────────────────

    // `_expr` never includes struct_literal or slice_literal.  Those are only
    // valid in rvalue positions (see `_rval` below).  Keeping them out of
    // `_expr` eliminates the `ident {` ambiguity in while/if/for/match
    // conditions: the `{` can only start a block, never a struct body.
    _expr: $ => choice(
      $.assign_expr,
      $.binary_expr,
      $.unary_expr,
      $.cast_expr,
      $.call_expr,
      $.method_call_expr,
      $.index_expr,
      $.field_expr,
      $.range_expr,
      $.array_expr,
      $.sizeof_expr,
      $.alignof_expr,
      $.sqrt_expr,
      $.abs_expr,
      $.floor_expr,
      $.ceil_expr,
      $.round_expr,
      $.atomic_expr,
      $.path_expr,
      $.self_expr,
      $.identifier,
      $.integer_literal,
      $.float_literal,
      $.bool_literal,
      $.null_literal,
      $.uninit_literal,
      $.string_literal,
      $.raw_string_literal,
      $.cstring_literal,
      $.char_literal,
      $.primitive_type,
      $.paren_expr,
      $.unreachable_expr,
    ),

    // `_rval` extends `_expr` with struct_literal and slice_literal for true
    // rvalue positions: let initialisers, return values, function arguments, etc.
    _rval: $ => choice($._expr, $.struct_literal, $.slice_literal),

    assign_expr: $ => prec.right(PREC.ASSIGN, seq(
      $._expr,
      choice(
        '=', '+=', '-=', '*=', '/=', '%=',
        '&=', '|=', '^=', '<<=', '>>=',
      ),
      $._rval,
    )),

    binary_expr: $ => choice(
      prec.left(PREC.OR,      seq($._expr, 'or',  $._expr)),
      prec.left(PREC.AND,     seq($._expr, 'and', $._expr)),
      prec.left(PREC.COMPARE, seq($._expr, choice('==', '!=', '<', '<=', '>', '>='), $._expr)),
      prec.left(PREC.BITOR,   seq($._expr, '|',   $._expr)),
      prec.left(PREC.BITXOR,  seq($._expr, '^',   $._expr)),
      prec.left(PREC.BITAND,  seq($._expr, '&',   $._expr)),
      prec.left(PREC.SHIFT,   seq($._expr, choice('<<', '>>'), $._expr)),
      prec.left(PREC.ADD,     seq($._expr, choice('+', '-'), $._expr)),
      prec.left(PREC.MUL,     seq($._expr, choice('*', '/', '%', '+%', '-%', '*%'), $._expr)),

    ),

    unary_expr: $ => prec(PREC.UNARY, seq(
      choice('not', '-', '~', '*', '&', seq('&', 'mut')),
      $._expr,
    )),

    cast_expr: $ => prec.left(PREC.CAST, seq($._expr, 'as', $._type)),

    // callee_expr is the named rule used as call_expr.callee.
    // - identifier at prec CALL (= struct_literal prec) so `identifier •(` is a
    //   real GLR conflict resolved by [callee_expr, struct_literal]: `{` body
    //   confirms struct_literal, otherwise callee_expr/call_expr wins.
    // - path_expr at prec CALL+1 (> struct_literal prec) so `path_expr •(` always
    //   reduces to callee_expr deterministically (no struct_literal ambiguity there).
    callee_expr: $ => choice(
      prec(PREC.CALL, $.identifier),
      prec(PREC.CALL + 1, $.path_expr),
      $.paren_expr,
      $.self_expr,
      $.call_expr,
      $.method_call_expr,
      $.index_expr,
      $.field_expr,
    ),

    call_expr: $ => prec(PREC.CALL, seq(
      field('callee', $.callee_expr),
      field('args', $.arg_list),
    )),

    method_call_expr: $ => prec(PREC.CALL, seq(
      field('receiver', $._expr),
      '.',
      field('method', $.identifier),
      field('args', $.arg_list),
    )),

    arg_list: $ => seq(
      '(',
      optional(seq(
        $._call_arg,
        repeat(seq(',', $._call_arg)),
        optional(','),
      )),
      ')',
    ),

    // Arguments to a function call: either a value (rval) or a pure-type form
    // that cannot appear as an rval.  primitive_type and named_type are already
    // in _expr so they are covered by _rval.  slice_type (`[]T`) is the common
    // case; fn_ptr_type handles generic callbacks.  array_type (`[N]T`) is
    // excluded because `[expr]` is ambiguous with array_expr.
    _call_arg: $ => choice(
      $._rval,
      $.slice_type,
      $.fn_ptr_type,
      $.extern_fn_ptr_type,
    ),

    index_expr: $ => prec(PREC.CALL, seq(
      field('base', $._expr),
      '[',
      field('index', $._expr),
      ']',
    )),

    field_expr: $ => prec(PREC.CALL, seq(
      field('base', $._expr),
      '.',
      field('field', $.identifier),
    )),

    // Covers `start..end`, `start..` (open end), and `..end` (open start).
    // The open-end forms are used in slice-range indexing: `arr[2..]`, `arr[..3]`.
    range_expr: $ => prec.left(PREC.ADD - 1, choice(
      seq($._expr, '..', $._expr),
      seq($._expr, '..'),
      seq('..', $._expr),
    )),

    // Struct literal — two distinct forms to avoid GLR backtracking issues:
    //
    //   Form A — `Name(T) { ... }` (generic name, no qualifier):
    //     type_arg_list is REQUIRED so the GLR branch commits to it early and
    //     fails at `{` if the input isn't actually a struct literal; this
    //     prevents the branch from consuming `(args)` after `qualifier::name`.
    //
    //   Form B — `[Qualifier::]Name { ... }` (optional qualifier, no type args):
    //     Handles plain struct literals and generic-qualified literals like
    //     `Option(i32)::Variant { ... }` where the qualifier is a call_expr.
    //
    // The [callee_expr, struct_literal] GLR conflict fires at `identifier •(`
    // and explores both callee_expr (call) and Form A (generic struct) paths.
    // Form B has no type_arg_list so it fails immediately at `(` after
    // `qualifier::name`, leaving the callee_expr → call_expr path clean.
    struct_literal: $ => prec(PREC.CALL, choice(
      // Form A: Name(TypeArgs) { fields } — generic struct, no qualifier
      seq(
        field('name', $.identifier),
        field('type_args', $.type_arg_list),
        '{',
        optional(seq(
          $.field_init,
          repeat(seq(',', $.field_init)),
          optional(','),
        )),
        '}',
      ),
      // Form B: [Qualifier::]Name { fields } — plain or qualified struct.
      // qualifier accepts path_expr to handle module-qualified enum variants:
      // `ast::Type::FnPtr { ... }` where `ast::Type` is the qualifier.
      seq(
        optional(seq(field('qualifier', choice($.identifier, $.call_expr, $.path_expr)), '::')),
        field('name', $.identifier),
        '{',
        optional(seq(
          $.field_init,
          repeat(seq(',', $.field_init)),
          optional(','),
        )),
        '}',
      ),
    )),

    // Type arguments in a generic struct literal: `Vec(i32) { ... }`
    type_arg_list: $ => seq(
      '(',
      $._type,
      repeat(seq(',', $._type)),
      optional(','),
      ')',
    ),

    field_init: $ => seq(
      field('name', $.identifier),
      ':',
      field('value', $._rval),
    ),

    // `[]T { ptr: expr, len: expr }` or `[]mut T { ... }` — explicit slice construction.
    slice_literal: $ => seq(
      field('slice_type', $.slice_type),
      '{',
      optional(seq(
        $.field_init,
        repeat(seq(',', $.field_init)),
        optional(','),
      )),
      '}',
    ),

    array_expr: $ => seq(
      '[',
      optional(choice(
        seq($._rval, repeat(seq(',', $._rval)), optional(',')),
        seq($._rval, ';', $._expr),  // repeat syntax [val; N]
      )),
      ']',
    ),

    sizeof_expr: $ => seq('#sizeof', '(', $._type, ')'),
    alignof_expr: $ => seq('#alignof', '(', $._type, ')'),
    sqrt_expr: $ => seq('#sqrt', '(', $._expr, ')'),
    abs_expr: $ => seq('#abs', '(', $._expr, ')'),
    floor_expr: $ => seq('#floor', '(', $._expr, ')'),
    ceil_expr: $ => seq('#ceil', '(', $._expr, ')'),
    round_expr: $ => seq('#round', '(', $._expr, ')'),

    // `#atomic_load(&x, acquire)` and all RMW / cmpxchg forms — return a value.
    atomic_expr: $ => seq(
      choice(
        '#atomic_load',
        '#atomic_xchg',
        '#atomic_add',
        '#atomic_sub',
        '#atomic_and',
        '#atomic_or',
        '#atomic_xor',
        '#atomic_min',
        '#atomic_max',
        '#atomic_umin',
        '#atomic_umax',
        '#atomic_cmpxchg',
        '#atomic_cmpxchg_weak',
      ),
      '(',
      $._rval,
      repeat(seq(',', $._rval)),
      ')',
    ),

    // `#atomic_store(&mut x, val, release);` — statement only, no return value.
    atomic_store_stmt: $ => seq(
      '#atomic_store',
      '(',
      $._rval,
      repeat(seq(',', $._rval)),
      ')',
      ';',
    ),

    // Path: `Mod::item`, `Enum::Variant`, `pkg::mod::item` (3+ levels), or
    // `Enum(T)::Variant` (generic qualifier — `Enum(T)` is a call_expr).
    path_expr: $ => prec.left(seq(
      field('qualifier', choice($.identifier, $.call_expr, $.path_expr)),
      '::',
      field('name', $.identifier),
    )),

    self_expr: $ => 'self',

    paren_expr: $ => seq('(', $._rval, ')'),

    // ── Literals ─────────────────────────────────────────────────────────

    integer_literal: $ => token(choice(
      /[0-9][0-9_]*/,
      /0[xX][0-9a-fA-F][0-9a-fA-F_]*/,
      /0[bB][01][01_]*/,
    )),

    float_literal: $ => token(choice(
      /[0-9][0-9_]*\.[0-9][0-9_]*([eE][+-]?[0-9][0-9_]*)?/,
      /[0-9][0-9_]*[eE][+-]?[0-9][0-9_]*/,
    )),

    bool_literal: $ => choice('true', 'false'),
    null_literal: $ => 'null',
    uninit_literal: $ => 'uninit',

    string_literal: $ => token(seq(
      '"',
      repeat(choice(/[^"\\]/, seq('\\', /./  ))),
      '"',
    )),

    // `r"..."` — raw string, no escape processing, type []char
    raw_string_literal: $ => token(seq(
      'r',
      '"',
      /[^"]*/,
      '"',
    )),

    // `c"..."` — null-terminated, type *char
    cstring_literal: $ => token(seq(
      'c',
      '"',
      repeat(choice(/[^"\\]/, seq('\\', /./  ))),
      '"',
    )),

    char_literal: $ => token(seq(
      "'",
      choice(
        /[^'\\]/,
        seq('\\', choice(/[^x]/, seq(/[xX]/, /[0-9a-fA-F]{0,2}/))),
      ),
      "'",
    )),

    // ── Paths ────────────────────────────────────────────────────────────

    path: $ => seq(
      $.identifier,
      repeat(seq('::', $.identifier)),
    ),

    unreachable_expr: $ => 'unreachable',
  },
});

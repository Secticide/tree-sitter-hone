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
      optional('pub'),
      optional(choice('#inline', '#noinline')),
      'fn',
      field('name', $.identifier),
      field('params', $.param_list),
      optional(seq('->', field('return_type', $._type))),
      field('body', $.block),
    ),

    extern_fn: $ => seq(
      'extern',
      'fn',
      field('name', $.identifier),
      field('params', $.param_list),
      optional(seq('->', field('return_type', $._type))),
      ';',
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
      field('name', $.identifier),
      ':',
      field('type', $._type),
    ),

    variadic_param: $ => '...',

    // ── Struct ───────────────────────────────────────────────────────────

    struct_def: $ => seq(
      optional('pub'),
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
      'type',
    ),

    struct_field: $ => seq(
      optional('pub'),
      field('name', $.identifier),
      ':',
      field('type', $._type),
      ',',
    ),

    // ── Enum ─────────────────────────────────────────────────────────────

    enum_def: $ => seq(
      optional('pub'),
      'enum',
      field('name', $.identifier),
      optional(field('type_params', $.type_param_list)),
      '{',
      repeat($.enum_variant),
      '}',
    ),

    enum_variant: $ => seq(
      field('name', $.identifier),
      optional(seq('{', repeat($.struct_field), '}')),
      ',',
    ),

    // ── Extern union ─────────────────────────────────────────────────────

    extern_union_def: $ => seq(
      optional('pub'),
      'extern',
      'union',
      field('name', $.identifier),
      '{',
      repeat($.struct_field),
      '}',
    ),

    // ── Impl ─────────────────────────────────────────────────────────────

    impl_block: $ => seq(
      'impl',
      field('name', $.identifier),
      optional(field('type_params', $.type_param_list)),
      '{',
      repeat($.function_def),
      '}',
    ),

    // ── Modules ──────────────────────────────────────────────────────────

    mod_block: $ => seq(
      optional('pub'),
      'mod',
      field('name', $.identifier),
      '{',
      repeat($._item),
      '}',
    ),

    mod_decl: $ => seq(
      optional('pub'),
      'mod',
      field('name', $.identifier),
      ';',
    ),

    // ── Use ──────────────────────────────────────────────────────────────

    use_decl: $ => seq('use', $.path, ';'),

    // ── Type alias ───────────────────────────────────────────────────────

    type_alias: $ => seq(
      optional('pub'),
      'type',
      field('name', $.identifier),
      '=',
      field('type', $._type),
      ';',
    ),

    // ── Global let ───────────────────────────────────────────────────────

    global_let: $ => seq(
      optional('pub'),
      'let',
      field('name', $.identifier),
      ':',
      field('type', $._type),
      '=',
      field('value', $._expr),
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
      $.pointer_type,
      $.ref_type,
      $.array_type,
      $.slice_type,
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

    pointer_type: $ => prec(PREC.UNARY, seq('*', optional('mut'), $._type)),
    ref_type: $ => prec(PREC.UNARY, seq('&', optional('mut'), $._type)),

    array_type: $ => seq('[', field('size', $._expr), ']', field('element', $._type)),
    slice_type: $ => seq('[', ']', optional('mut'), field('element', $._type)),

    generic_type: $ => prec(1, seq(
      field('name', $.identifier),
      '(',
      $._type,
      repeat(seq(',', $._type)),
      optional(','),
      ')',
    )),

    named_type: $ => $.identifier,

    // ── Statements ───────────────────────────────────────────────────────

    _stmt: $ => choice(
      $.let_stmt,
      $.return_stmt,
      $.break_stmt,
      $.continue_stmt,
      $.defer_stmt,
      $.fence_stmt,
      $.if_stmt,
      $.while_stmt,
      $.for_stmt,
      $.match_stmt,
      $.hash_if_stmt,
      $.block,
      $.expr_stmt,
    ),

    let_stmt: $ => seq(
      'let',
      optional('mut'),
      field('name', choice($.identifier, $.wildcard)),
      optional(seq(':', field('type', $._type))),
      optional(seq('=', field('value', $._expr))),
      optional(seq('else', field('else_body', $.block))),
      ';',
    ),

    return_stmt: $ => seq('return', optional($._expr), ';'),
    break_stmt:    $ => seq('break', ';'),
    continue_stmt: $ => seq('continue', ';'),

    fence_stmt: $ => seq(
      '#fence',
      optional(seq('(', field('ordering', $.identifier), ')')),
      ';',
    ),

    defer_stmt: $ => seq('defer', $._stmt),

    if_stmt: $ => prec.right(seq(
      'if',
      optional(seq('let', field('pattern', $._pattern), '=')),
      field('cond', $._expr),
      field('then', $.block),
      optional(seq('else', field('else', choice($.if_stmt, $.block)))),
    )),

    while_stmt: $ => seq('while', field('cond', $._expr), field('body', $.block)),

    for_stmt: $ => seq(
      'for',
      field('var', $.identifier),
      optional(seq(':', field('var_type', $._type))),
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

    struct_pattern: $ => seq(
      optional(seq(field('enum_name', $.identifier), '::')),
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

    path_pattern: $ => seq(
      optional(seq(field('qualifier', $.identifier), '::')),
      field('name', $.identifier),
    ),

    // ── Expressions ──────────────────────────────────────────────────────

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
      $.struct_literal,
      $.array_expr,
      $.sizeof_expr,
      $.alignof_expr,
      $.likely_expr,
      $.unlikely_expr,
      $.path_expr,
      $.self_expr,
      $.integer_literal,
      $.float_literal,
      $.bool_literal,
      $.null_literal,
      $.uninit_literal,
      $.string_literal,
      $.cstring_literal,
      $.char_literal,
      $.paren_expr,
      $.unreachable_expr,
    ),

    assign_expr: $ => prec.right(PREC.ASSIGN, seq(
      $._expr,
      choice(
        '=', '+=', '-=', '*=', '/=', '%=',
        '&=', '|=', '^=', '<<=', '>>=',
      ),
      $._expr,
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

    call_expr: $ => prec(PREC.CALL, seq(
      field('callee', $._expr),
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
        $._expr,
        repeat(seq(',', $._expr)),
        optional(','),
      )),
      ')',
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

    range_expr: $ => prec.left(PREC.ADD - 1, seq($._expr, '..', $._expr)),

    // Struct literal: `Foo { field: val, ... }` or `Enum::Variant { field: val }`
    struct_literal: $ => prec(PREC.CALL, seq(
      optional(seq(field('qualifier', $.identifier), '::')),
      field('name', $.identifier),
      optional($.type_arg_list),
      '{',
      optional(seq(
        $.field_init,
        repeat(seq(',', $.field_init)),
        optional(','),
      )),
      '}',
    )),

    // Type arguments in a struct literal: `Vec(i32) { ... }`
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
      field('value', $._expr),
    ),

    array_expr: $ => seq(
      '[',
      choice(
        seq($._expr, repeat(seq(',', $._expr)), optional(',')),
        seq($._expr, ';', $._expr),  // repeat syntax [val; N]
      ),
      ']',
    ),

    sizeof_expr: $ => seq('#sizeof', '(', $._type, ')'),
    alignof_expr: $ => seq('#alignof', '(', $._type, ')'),

    likely_expr: $ => seq('#likely', '(', $._expr, ')'),
    unlikely_expr: $ => seq('#unlikely', '(', $._expr, ')'),

    // Path: `Mod::item` or `Enum::Variant` or just `name`
    path_expr: $ => seq(
      field('qualifier', $.identifier),
      '::',
      field('name', $.identifier),
      optional($.type_arg_list),
    ),

    self_expr: $ => 'self',

    paren_expr: $ => seq('(', $._expr, ')'),

    // ── Literals ─────────────────────────────────────────────────────────

    integer_literal: $ => token(choice(
      /[0-9][0-9_]*/,
      /0[xX][0-9a-fA-F][0-9a-fA-F_]*/,
      /0[bB][01][01_]*/,
    )),

    float_literal: $ => token(
      /[0-9][0-9_]*\.[0-9][0-9_]*/,
    ),

    bool_literal: $ => choice('true', 'false'),
    null_literal: $ => 'null',
    uninit_literal: $ => 'uninit',

    string_literal: $ => token(seq(
      '"',
      repeat(choice(/[^"\\]/, seq('\\', /./  ))),
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

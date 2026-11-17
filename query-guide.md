# Notification Rule Query Format Guide

This document describes the `NotificationRule` data structure used to define notification rules. A rule can match nodes through either a **structured query (`QueryMatch`)** or a **CEL expression (string)**. Structured queries are based on `QueryExpression<T>` and support field comparisons, array operations, and nested logic composed with `$where` / `$with`.

---

## 1. Type Definitions

```typescript
export type RuleExpect = "all" | "any" | "none";

export type QueryMatch<T> = {
    $ns?: string;
    expect: RuleExpect;
    match: QueryExpression<T>;
}

export interface NotificationRule<T = any> {
    id?: string;
    description?: string;
    active?: boolean;
    matchExpression: QueryMatch<T> | string;
    notify?: {
        channels?: string[];
        message?: string;
    };
}
```

### 1.1 QueryExpression-related Types

```typescript
export declare type LinkOperator = "==" | "->";
export declare type ROperator_Atom = ">=" | ">" | "<" | "<=" | "==" | "===" | "!=" | "!==";
export declare type ROperator_Array = "IN" | "!IN";
export declare type ROperator = ROperator_Atom | ROperator_Array;
export declare type BOperator = "&&" | "||";

export type QueryOnAtomValue<T, P extends keyof T> = {
    $op?: ROperator_Atom;
    $val: T[P] | null | undefined;
};

export type QueryOnArrayValue<T, P extends keyof T> = {
    $op?: ROperator_Array;
    $val: T[P][];
};

export type QueryOnValue<T, P extends keyof T> = QueryOnAtomValue<T, P> | QueryOnArrayValue<T, P>;

export type QueryOn<T> = {
    [P in keyof T]?: QueryOnValue<T, P> | T[P];
};

export type QueryExpressionWhere<T> = {
    $with?: BOperator;
    $where?: Array<QueryExpression<T>>;
};

export type QueryExpression<T> = QueryExpressionWhere<T> & QueryOn<T>;
```

---

## 2. Field Reference

### 2.1 NotificationRule

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | No | Unique rule identifier |
| `description` | `string` | No | Rule description |
| `active` | `boolean` | No | Whether the rule is enabled |
| `matchExpression` | `QueryMatch<T> \| string` | Yes | Matching expression. When an object, a structured query is used; when a string, a CEL expression is used |
| `notify` | `object` | No | Notification configuration |
| `notify.channels` | `string[]` | No | Notification channels, e.g. `["web-console"]` |
| `notify.message` | `string` | No | Notification message content |

### 2.2 QueryMatch

When `matchExpression` is an object, its structure is as follows:

```typescript
{
  $ns?: string;          // Namespace, depends on the $ns of the current context (LinkNode) node
  expect: "all" | "any" | "none";
  match: QueryExpression;
}
```

- **`$ns`**: Optional. Represents the namespace. **It depends on the `$ns` of the current context (LinkNode) node.** If the current context has no `$ns` at all, using this field must raise an error.
- **`expect`**: Required. Expectation type:
  - `"all"`: all matched items satisfy the condition
  - `"any"`: any matched item satisfies the condition
  - `"none"`: no matched item satisfies the condition
- **`match`**: Required. A `QueryExpression<T>` object. See Section 3 for details.

---

## 3. QueryExpression Details

`QueryExpression<T>` is an intersection of two parts:

1. **`QueryOn<T>`**: Field conditions. Keys are object field names, and values can be:
   - A direct value (shorthand for equality comparison, e.g. `"amount": 1000`);
   - `QueryOnAtomValue`: atomic comparison, e.g. `{ "$op": ">=", "$val": 1000 }`;
   - `QueryOnArrayValue`: array operation, e.g. `{ "$op": "IN", "$val": ["paid", "pending"] }`.
2. **`QueryExpressionWhere<T>`**: Logical composition.
   - `$with?: "&&" | "||"`: used to connect multiple sub-expressions in the `$where` array.
   - `$where?: Array<QueryExpression<T>>`: array of sub-expressions. Each element is also a `QueryExpression` and can be nested further.

### 3.1 Operators

| Operator | Type | Description |
|----------|------|-------------|
| `>=` | Atom | Greater than or equal to |
| `>` | Atom | Greater than |
| `<` | Atom | Less than |
| `<=` | Atom | Less than or equal to |
| `==` | Atom | Equal to |
| `===` | Atom | Strictly equal to |
| `!=` | Atom | Not equal to |
| `!==` | Atom | Strictly not equal to |
| `IN` | Array | Value is in the array |
| `!IN` | Array | Value is not in the array |

- For atomic operators, `$val` is a single value (which may be `null` / `undefined`).
- For array operators, `$val` must be an array.
- If `$op` is omitted, equality comparison is usually assumed; explicitly specifying it is recommended to avoid ambiguity.
- `LinkOperator` (`==`, `->`) is a reserved link operator and is not directly used in the current query expression. It is reserved for extension.

### 3.2 Field Condition Forms

**Direct value (equality shorthand):**

```json
{
  "status": "paid"
}
```

**Atomic comparison:**

```json
{
  "amount": {
    "$op": ">=",
    "$val": 1000
  }
}
```

**Array operation:**

```json
{
  "status": {
    "$op": "IN",
    "$val": ["paid", "pending"]
  }
}
```

Multiple field conditions are combined with **AND** by default.

### 3.3 Nested Logic (`$where` / `$with`)

When multiple conditions need to be combined (especially with OR logic), use the `$where` array and specify the connection mode within the array via `$with`:

```json
{
  "$with": "||",
  "$where": [
    { "amount": { "$op": ">=", "$val": 1000 } },
    { "status": { "$op": "==", "$val": "vip" } }
  ]
}
```

- `$with` only applies to the `$where` array at the same level.
- Each element in `$where` is a complete `QueryExpression` and can contain nested `$where`.
- Field conditions at the current level and the result of `$where` are usually combined with **AND** (subject to implementation); for clarity, it is recommended to put complex logic entirely into `$where` sub-expressions.

### 3.4 Composition Example

```json
{
  "match": {
    "$with": "&&",
    "$where": [
      {
        "amount": { "$op": ">=", "$val": 1000 }
      },
      {
        "$with": "||",
        "$where": [
          { "status": { "$op": "IN", "$val": ["paid", "pending"] } },
          { "priority": { "$op": "==", "$val": "high" } }
        ]
      }
    ]
  }
}
```

This means: `amount >= 1000` AND (`status IN ["paid","pending"]` OR `priority == "high"`).

---

## 4. CEL Expressions

When `matchExpression` is a string, it represents a **CEL (Common Expression Language)** expression. **A CEL expression must return a boolean value**, indicating whether the condition is satisfied.

### Available Variables and Functions

- `nodes`: all nodes in the current context (an array of LinkNode).
- Each node contains:
  - `$ns`: namespace
  - `data`: business data object, e.g. `n.data.amount`
- CEL built-in functions can be used: `filter`, `map`, `sum`, `double`, `all`, `exists`, etc.

### Examples

**Compute the sum of all amounts under the `Payment` namespace and check whether it is >= 1000:**

```cel
sum(nodes.filter(n, n.$ns == 'Payment').map(n, double(n.data.amount))) >= 1000
```

**Check that all `Payment` nodes have `amount >= 1000`:**

```cel
nodes.filter(n, n.$ns == 'Payment').all(n, double(n.data.amount) >= 1000)
```

**Check whether any `Payment` node has `amount > 5000`:**

```cel
nodes.filter(n, n.$ns == 'Payment').exists(n, double(n.data.amount) > 5000)
```

### Notes

- A CEL expression must return a boolean value; otherwise, an error must be raised.
- If `$ns` is used in the expression, the current context node must have `$ns`; otherwise, an error will occur. It can be checked first with `has(n.$ns)`.
- The user-provided example `"sum(nodes.filter(n, n.$ns == 'Payment').map(n, double(n.data.amount)))"` returns a number. In actual use, it usually needs to be compared with a threshold, e.g. `>= 1000`.

---

## 5. Complete Examples

### Example 1: QueryMatch Object (`expect: "all"`)

```json
{
  "id": "Payment-Amount-1000",
  "description": "All payment.amount >= 1,000",
  "active": true,
  "matchExpression": {
    "$ns": "Payment",
    "expect": "all",
    "match": {
      "amount": {
        "$op": ">=",
        "$val": 1000
      }
    }
  },
  "notify": {
    "channels": ["web-console"],
    "message": "Failed: All payment.amount >= 1,000"
  }
}
```

### Example 2: CEL Expression

```json
{
  "id": "Payment-Sum-1000",
  "description": "Sum of payment amounts >= 1000",
  "active": true,
  "matchExpression": "sum(nodes.filter(n, n.$ns == 'Payment').map(n, double(n.data.amount))) >= 1000",
  "notify": {
    "channels": ["web-console"],
    "message": "Payment sum is less than 1000"
  }
}
```

### Example 3: `expect: "any"`

```json
{
  "id": "Any-Payment-Large",
  "description": "Any payment amount > 5000",
  "active": true,
  "matchExpression": {
    "$ns": "Payment",
    "expect": "any",
    "match": {
      "amount": {
        "$op": ">",
        "$val": 5000
      }
    }
  },
  "notify": {
    "channels": ["web-console"],
    "message": "No payment amount exceeds 5000"
  }
}
```

### Example 4: `expect: "none"`

```json
{
  "id": "No-Payment-Negative",
  "description": "No payment amount is negative",
  "active": true,
  "matchExpression": {
    "$ns": "Payment",
    "expect": "none",
    "match": {
      "amount": {
        "$op": "<",
        "$val": 0
      }
    }
  },
  "notify": {
    "channels": ["web-console"],
    "message": "Found negative payment amount"
  }
}
```

### Example 5: Array Operations and Nested Logic

```json
{
  "id": "Payment-Complex",
  "description": "amount >= 1000 and (status IN paid/pending or priority high)",
  "active": true,
  "matchExpression": {
    "$ns": "Payment",
    "expect": "all",
    "match": {
      "$with": "&&",
      "$where": [
        { "amount": { "$op": ">=", "$val": 1000 } },
        {
          "$with": "||",
          "$where": [
            { "status": { "$op": "IN", "$val": ["paid", "pending"] } },
            { "priority": { "$op": "==", "$val": "high" } }
          ]
        }
      ]
    }
  },
  "notify": {
    "channels": ["web-console"],
    "message": "Complex payment condition failed"
  }
}
```

---

## 6. Generation Guide (for DeepSeek API)

When generating JSON based on user prompts, follow these steps:

1. **Determine rule metadata**: `id`, `description`, `active`.
2. **Choose the matching approach**:
   - If the condition is based on field comparisons, array containment, or simple logical composition, use a `QueryMatch` object.
   - If the condition is complex and requires aggregation or custom logic, use a CEL expression string.
3. **Construct `matchExpression`**:
   - **QueryMatch**:
     - Set `$ns` (if the user specifies a namespace; ensure the context has `$ns`).
     - Set `expect` to `"all"` / `"any"` / `"none"`.
     - Construct `match` (`QueryExpression`):
       - For simple conditions, write the field directly with `{ "$op": ..., "$val": ... }`.
       - For multiple conditions, use a `$where` array and specify `&&` / `||` with `$with`.
       - For array operations, use `IN` / `!IN`; `$val` must be an array.
   - **CEL**:
     - Write an expression that returns a boolean value.
     - Use `nodes`, `filter`, `map`, `sum`, `double`, etc.
4. **Set `notify`**: `channels` and `message`.
5. **Validation**:
   - If `$ns` is used but the current context has no `$ns`, raise an error.
   - If the CEL expression returns a non-boolean value, raise an error.
   - For array operators, `$val` must be an array; for atomic operators, `$val` is a single value.
   - An unknown `$op` must raise an error.

---

## 7. Error Handling

- **Missing `$ns`**: When a rule uses `$ns` but the current context (LinkNode) node has no `$ns`, an error must be raised, e.g.: "The current context has no `$ns`; namespace filtering cannot be used."
- **CEL returns a non-boolean value**: A CEL expression must return a boolean value. If the user-provided expression returns a number (e.g. `sum(...)`), prompt the user to add a comparison condition, e.g. change it to `sum(...) >= 1000`.
- **Unknown operator**: If `$op` is not in the supported list, raise an error and list the supported operators.
- **Operator/value type mismatch**: `$val` for `IN` / `!IN` must be an array; `$val` for atomic operators should not be an array (unless the field itself is an array, handled according to the implementation).
- **`$where` is not an array**: `$where` must be an array; `$with` must be `"&&"` or `"||"`.

---

This is the complete guide to the `NotificationRule` query format, for reference when generating JSON queries or CEL queries later.
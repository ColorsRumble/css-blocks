import {
  AST,
  builders,
} from '@glimmer/syntax';

import {
  IndexedClassRewrite,
  DynamicClasses,
  isTrueCondition,
  isFalseCondition,
  BlockObject,
  hasDependency,
  isSwitch,
  isConditional,
  Dependency,
  Conditional,
  HasState,
  HasGroup,
  Switch,
} from "css-blocks";
import {
  TemplateElement,
  TernaryExpression,
  BooleanExpression,
  StringExpression,
} from './ElementAnalyzer';
import {
  SourceExpression,
  FalsySwitchBehavior,
} from "./helpers/classnames";

export type Builders = typeof builders;

export function classnamesHelper(rewrite: IndexedClassRewrite<BlockObject>, element: TemplateElement): AST.MustacheStatement {
  return builders.mustache(
    builders.path('/css-blocks/components/classnames'),
    constructArgs(rewrite, element)
  );
}

function constructArgs(rewrite: IndexedClassRewrite<any>, element: TemplateElement): AST.Expression[] {
  let expr = new Array<AST.Expression>();
  expr.push(builders.number(element.dynamicClasses.length + element.dynamicStates.length));
  expr.push(builders.number(rewrite.dynamicClasses.length));
  expr.push(...constructSourceArgs(rewrite, element));
  expr.push(...constructOutputArgs(rewrite, element));
  return expr;
}

function constructSourceArgs(rewrite: IndexedClassRewrite<any>, element: TemplateElement): AST.Expression[] {
  let expr = new Array<AST.Expression>();
  for (let classes of element.dynamicClasses) {
    // type of expression
    expr.push(builders.number(SourceExpression.ternary));
    expr.push(...constructTernary(classes, rewrite));
  }
  for (let stateExpr of element.dynamicStates) {
    if (isSwitch(stateExpr)) {
      if (hasDependency(stateExpr)) {
        expr.push(builders.number(SourceExpression.switchWithDep));
        expr.push(...constructDependency(stateExpr, rewrite));
      } else {
        expr.push(builders.number(SourceExpression.switch));
      }
      expr.push(...constructSwitch(stateExpr, rewrite));
    } else {
      let type = 0;
      if (hasDependency(stateExpr)) {
        type = type | SourceExpression.dependency;
      }
      if (isConditional(stateExpr)) {
        type = type | SourceExpression.boolean;
      }
      expr.push(builders.number(type));
      if (hasDependency(stateExpr)) {
        expr.push(...constructDependency(stateExpr, rewrite));
      }
      if (isConditional(stateExpr)) {
        expr.push(...constructBoolean(stateExpr, rewrite));
      }
      expr.push(...constructStateReferences(stateExpr, rewrite));
    }
  }
  return expr;
}

/**
 * Boolean Ternary:
 * 1: expression to evaluate as truthy
 * 2: number (t) of source styles set if true
 * 3..(3+t-1): indexes of source styles set if true
 * (3+t): number (f) of source styles set if false
 * (4+t)..(4+t+f-1): indexes of source styles set if false
 */
function constructTernary(classes: DynamicClasses<TernaryExpression>, rewrite: IndexedClassRewrite<BlockObject>): AST.Expression[] {
  let expr = new Array<AST.Expression>();
  // The boolean expression
  expr.push(classes.condition);
  // The true styles
  if (isTrueCondition(classes)) {
    expr.push(builders.number(classes.whenTrue.length));
    // TODO: inheritance
    expr.push(...classes.whenTrue.map(style => builders.number(rewrite.indexOf(style))));
  } else {
    expr.push(builders.number(0));
  }
  // The false styles
  if (isFalseCondition(classes)) {
    expr.push(builders.number(classes.whenFalse.length));
    // TODO: inheritance
    expr.push(...classes.whenFalse.map(style => builders.number(rewrite.indexOf(style))));
  } else {
    expr.push(builders.number(0));
  }
  return expr;
}

/*
 * if conditional type has a dependency:
 *   3/4: number (d) of style indexes this is dependent on.
 *   4/5..((4/5)+d-1): style indexes that must be set for this to be true
 */
function constructDependency(stateExpr: Dependency, rewrite: IndexedClassRewrite<BlockObject>): AST.Expression[] {
  let expr = new Array<AST.Expression>();
  expr.push(builders.number(1));
  expr.push(builders.number(rewrite.indexOf(stateExpr.container)));
  return expr;
}

function constructBoolean(stateExpr: Conditional<BooleanExpression> & HasState, _rewrite: IndexedClassRewrite<BlockObject>): AST.Expression[] {
  let expr = new Array<AST.Expression>();
  expr.push(stateExpr.condition);
  return expr;
}

function constructStateReferences(stateExpr: HasState, rewrite: IndexedClassRewrite<BlockObject>): AST.Expression[] {
  let expr = new Array<AST.Expression>();
  // TODO: inheritance
  expr.push(builders.number(1));
  expr.push(builders.number(rewrite.indexOf(stateExpr.state)));
  return expr;
}
/*
 * * String switch:
 * 1: conditional type: 4 - switch, 5 - both switch and dependency
 * if conditional type has a dependency:
 *   2: number (d) of style indexes this is dependent on.
 *   3..((3)+d-1): style indexes that must be set for this to be true
 * 1: number (n) of strings that can be returned
 * 2: whether a falsy value is an error (0), unsets the values (1)
 *    or provide a default (2) if a string
 * 3?: the default value if the falsy behavior is default (2)
 * then: expression to evaluate as a string
 * For each of the <n> strings that can be returned:
 *   1: string that can be returned by the expression
 *   2: number (s) of source styles set. s >= 1
 *   3..3+s-1: indexes of source styles set
 */
function constructSwitch(stateExpr: Switch<StringExpression> & HasGroup, rewrite: IndexedClassRewrite<BlockObject>): AST.Expression[] {
  let expr = new Array<AST.Expression>();
  let values = Object.keys(stateExpr.group);
  expr.push(builders.number(values.length));
  if (stateExpr.disallowFalsy) {
    expr.push(builders.number(FalsySwitchBehavior.error));
  } else {
    expr.push(builders.number(FalsySwitchBehavior.unset));
  }
  expr.push(moustacheToStringExpression(stateExpr.stringExpression));
  for (let value of values) {
    let obj = stateExpr.group[value];
    expr.push(builders.string(value));
    expr.push(builders.number(1));
    expr.push(builders.number(rewrite.indexOf(obj)));
  }
  return expr;
}

function moustacheToStringExpression(stringExpression: StringExpression): AST.Expression {
  if (stringExpression.type === "ConcatStatement") {
    return builders.sexpr(builders.path("/css-blocks/components/concat"),
      stringExpression.parts.reduce( (arr, val) => {
        if (val.type === 'TextNode') {
          arr.push(builders.string(val.chars));
        } else {
          arr.push(moustacheToStringExpression(val));
        }
        return arr;
      }, new Array<AST.Expression>())
    );
  } else {
    let { path, params, hash } = stringExpression;
    if (path.type === "PathExpression") {
      return builders.sexpr(path, params, hash);
    } else {
      if (params.length > 0) {
        throw new Error("Unsure how to deal with this node.");
      }
      return path;
    }
  }
}

function constructOutputArgs(_rewrite: IndexedClassRewrite<any>, _element: TemplateElement): AST.Expression[] {
  let expr = new Array<AST.Expression>();
  return expr;
}
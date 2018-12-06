import { suite, test } from "mocha-typescript";

import { InvalidBlockSyntax } from "../../src";

import { BEMProcessor } from "../util/BEMProcessor";

@suite("Disallowed Pseudo Classes")
export class DisallowedPseudos extends BEMProcessor {

  @test "disallows the :not() pseudoclass."() {
    let filename = "foo/bar/illegal-not-pseudoclass.css";
    let inputCSS = `:scope {color: #111;}
                    .another-class:not([state|foo]) { display: block; }`;
    return this.assertError(
      InvalidBlockSyntax,
      "The :not() pseudoclass cannot be used: .another-class:not([state|foo])" +
        " (foo/bar/illegal-not-pseudoclass.css:2:35)",
      this.process(filename, inputCSS));
  }

  @test "disallows the :matches() pseudoclass."() {
    let filename = "foo/bar/illegal-not-pseudoclass.css";
    let inputCSS = `:scope {color: #111;}
                    .another-class:matches([state|foo]) { display: block; }`;
    return this.assertError(
      InvalidBlockSyntax,
      "The :matches() pseudoclass cannot be used: .another-class:matches([state|foo])" +
        " (foo/bar/illegal-not-pseudoclass.css:2:35)",
      this.process(filename, inputCSS));
  }

  @test "disallows pseudos not attached to a block object."() {
    let filename = "foo/bar/illegal-class-combinator.css";
    let inputCSS = `:scope :hover { display: block; }`;
    return this.assertError(
      InvalidBlockSyntax,
      "Missing block object in selector component ':hover': :scope :hover" +
        " (foo/bar/illegal-class-combinator.css:1:8)",
      this.process(filename, inputCSS));
  }

}

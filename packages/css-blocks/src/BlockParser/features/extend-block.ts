import * as postcss from 'postcss';
import * as errors from '../../errors';
import { sourceLocation } from "../../SourceLocation";
import { Block } from "../../Block";

/**
 * For each `extends` property found in the passed ruleset, set the block's base
 * to the foreign block. If block is not found, throw.
 * @param block  Block object being processed.
 * @param sourceFile  Source file name, used for error output.
 * @param rule Ruleset to crawl.
 */
export default async function extendBlock(rule: postcss.Root, block: Block, sourceFile: string) {
  rule.walkDecls("extends", (decl) => {
    if (block.base) {
      throw new errors.InvalidBlockSyntax(`A block can only be extended once.`, sourceLocation(sourceFile, decl));
    }
    let baseName = decl.value;
    let baseBlock = block.getReferencedBlock(baseName);
    if (!baseBlock) {
      throw new errors.InvalidBlockSyntax(`No block named ${baseName} found`, sourceLocation(sourceFile, decl));
    }
    block.setBase(baseName, baseBlock);
  });
}

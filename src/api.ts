import { DocumentSymbol, Location, LocationLink, Position, Uri, commands } from 'vscode';
import { Option, isNone, none, some } from 'fp-ts/lib/Option';

export const getDocumentSymbols = async (uri: Uri) => {
  return (await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri))!;
};

export const getDefinition = async (uri: Uri, pos: Position): Promise<Option<LocationLink>> => {
  const defs = (await commands.executeCommand<LocationLink[]>('vscode.executeDefinitionProvider', uri, pos))!;
  return defs.length === 0 ? none : some(defs[0]);
};

export const getReferences = async (uri: Uri, pos: Position) => {
  return (await commands.executeCommand<Location[]>('vscode.executeReferenceProvider', uri, pos))!;
};

export const getSymbol = async (uri: Uri, pos: Position): Promise<Option<[DocumentSymbol, LocationLink]>> => {
  const def = await getDefinition(uri, pos);
  if (isNone(def)) {
    return none;
  }

  const syms = await getDocumentSymbols(def.value.targetUri).then(flattenDocumentSymbols);
  for (const sym of syms) {
    if (def.value.targetRange.contains(sym.selectionRange)) {
      return some([sym, def.value]);
    }
  }

  // find symbol by references
  const refs = await getReferences(uri, pos);
  for (const ref of refs) {
    for (const sym of syms) {
      if (sym.selectionRange.contains(ref.range)) {
        return some([sym, def.value]);
      }
    }
  }

  return none;
};

const flattenDocumentSymbols = (syms: DocumentSymbol[]) => {
  const dig = (sym: DocumentSymbol) => {
    const acc = [sym];
    for (const child of sym.children) {
      acc.push(...dig(child));
    }
    return acc;
  };

  const acc = [];
  for (const sym of syms) {
    acc.push(...dig(sym));
  }

  return acc;
};

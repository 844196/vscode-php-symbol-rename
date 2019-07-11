import { Uri, DocumentSymbol, commands, Position, Location } from 'vscode';
import { none, some, Option, isNone } from 'fp-ts/es6/Option';

export const getDocumentSymbols = async (uri: Uri) => {
  return (await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri))!;
};

export const getDefinition = async (uri: Uri, pos: Position): Promise<Option<Location>> => {
  const defs = (await commands.executeCommand<Location[]>('vscode.executeDefinitionProvider', uri, pos))!;
  return defs.length === 0 ? none : some(defs[0]);
};

export const getReferences = async (uri: Uri, pos: Position) => {
  return (await commands.executeCommand<Location[]>('vscode.executeReferenceProvider', uri, pos))!;
};

export const getSymbol = async (uri: Uri, pos: Position): Promise<Option<[DocumentSymbol, Location]>> => {
  const def = await getDefinition(uri, pos);
  if (isNone(def)) {
    return none;
  }

  const syms = await getDocumentSymbols(def.value.uri).then(flattenDocumentSymbols);
  for (const sym of syms) {
    if (def.value.range.contains(sym.selectionRange)) {
      return some([sym, def.value]);
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

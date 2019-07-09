import { Range, commands, DocumentSymbol, Location, Position, RenameProvider, SymbolKind, TextDocument, Uri, WorkspaceEdit, workspace } from 'vscode';

export class PhpRenameProvider implements RenameProvider {
  public async prepareRename(doc: TextDocument, pos: Position) {
    const [sym, def] = await getSymbol(doc.uri, pos);
    if (!sym || !def) {
      throw new Error('You can not rename this symbol');
    }

    if (onVendor(def)) {
      console.log('vendor以下に定義があるためキャンセル', def);

      // TODO
      //   -  vendor定義の定数名・メソッド名・プロパティ名を書き換えてはいけない
      //   - クラス名・抽象クラス・トレイト名・インターフェイス名はコンテキストによる
      throw new Error('You can not rename this symbol');
    }

    return undefined;
  }

  public async provideRenameEdits(doc: TextDocument, pos: Position, newName: string) {
    const targets = await getReferences(doc.uri, pos);
    if (targets.length === 0) {
      return;
    }

    const edit = new WorkspaceEdit();
    const [sym, def] = await getSymbol(doc.uri, pos);
    if (!sym || !def) {
      return;
    }

    for (const target of targets) {
      if (onVendor(target)) {
        continue;
      }

      if (sym.kind === SymbolKind.Property) {
        // e.g. $foo -> foo
        // e.g. foo  -> foo
        const normarized = newName.replace(/^\$/, '');

        edit.replace(
          target.uri,
          target.range,
          JSON.stringify(target) === JSON.stringify(def) ? `$${normarized}` : normarized
        );

        continue;
      }

      if (sym.kind === SymbolKind.Class) {
        // めんどくさそう
      }

      edit.replace(target.uri, target.range, newName);
    }

    return edit;
  }
}

// TODO Eitherモナド
const getSymbol = async (uri: Uri, pos: Position): Promise<[undefined, undefined] | [DocumentSymbol, Location]> => {
  const def = await getDefinition(uri, pos);
  if (!def) {
    return [undefined, undefined];
  }
  console.log('シンボル定義を発見', def);

  const syms = await getDocumentSymbols(def.uri).then(flattenDocumentSymbols);
  for (const sym of syms) {
    console.log('シンボルを検証', JSON.stringify({
      def: rangeToString(def.range),
      [sym.name]: rangeToString(sym.selectionRange),
    }));

    if (def.range.contains(sym.selectionRange)) {
      console.log('シンボル発見', sym);
      return [sym, def];
    }
  }

  return [undefined, undefined];
};

const getReferences = async (uri: Uri, pos: Position) => {
  return (await commands.executeCommand<Location[]>('vscode.executeReferenceProvider', uri, pos))!;
};

const getDefinition = async (uri: Uri, pos: Position) => {
  const defs = (await commands.executeCommand<Location[]>('vscode.executeDefinitionProvider', uri, pos))!;
  return defs.length === 0 ? undefined : defs[0];
};

const getDocumentSymbols = async (uri: Uri) => {
  return (await commands.executeCommand<DocumentSymbol[]>('vscode.executeDocumentSymbolProvider', uri))!;
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

const workspaceVendors = () =>
  (workspace.workspaceFolders || []).map(({ uri }) => `${uri.path}/vendor`);

const onVendor = (x: Location) =>
  workspaceVendors().some((vp) => x.uri.path.includes(vp));

const rangeToString = ({ start, end }: Range) =>
  `${start.line}:${start.character}~${end.line}:${end.character}`;

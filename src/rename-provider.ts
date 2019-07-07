import { commands, DocumentSymbol, Location, Position, RenameProvider, SymbolKind, TextDocument, Uri, WorkspaceEdit, workspace } from 'vscode';

export class PhpRenameProvider implements RenameProvider {
  public async prepareRename(doc: TextDocument, pos: Position) {
    const symbol = await getSymbol(doc.uri, pos);
    if (!symbol) {
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
    const sym = (await getSymbol(doc.uri, pos))!;
    const def = (await getDefinition(doc.uri, pos))!;

    const workspaceVendors = (workspace.workspaceFolders || []).map(({ uri }) => `${uri.path}/vendor`);

    for (const target of targets) {
      if (workspaceVendors.some((vendorPath) => target.uri.path.includes(vendorPath))) {
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

const getSymbol = async (uri: Uri, pos: Position) => {
  const def = await getDefinition(uri, pos);
  if (!def) {
    return undefined;
  }

  const syms = await getDocumentSymbols(uri).then(flattenDocumentSymbols);
  for (const sym of syms) {
    if (sym.range.isEqual(def.range)) {
      return sym;
    }
  }
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

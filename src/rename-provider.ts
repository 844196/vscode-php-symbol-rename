import * as path from 'path';
import { Location, Position, Range, RenameProvider, SymbolKind, TextDocument, WorkspaceEdit, workspace } from 'vscode';
import { getReferences, getSymbol } from './api';
import { isNone } from 'fp-ts/lib/Option';

export class PhSymbolpRenameProvider implements RenameProvider {
  public async prepareRename(doc: TextDocument, pos: Position) {
    const result = await getSymbol(doc.uri, pos);
    if (isNone(result)) {
      throw new Error('You can not rename this symbol');
    }
    const [sym, def] = result.value;

    if (onVendor(def)) {
      throw new Error('You can not rename this symbol');
    }

    switch (sym.kind) {
      case SymbolKind.Class:
      case SymbolKind.Interface:
      case SymbolKind.Module:
        if (doc.uri.toString() !== def.uri.toString()) {
          throw new Error('You can not rename this symbol');
        }
    }

    return undefined;
  }

  public async provideRenameEdits(doc: TextDocument, pos: Position, newName: string) {
    const targets = await getReferences(doc.uri, pos);
    if (targets.length === 0) {
      return;
    }

    const result = await getSymbol(doc.uri, pos);
    if (isNone(result)) {
      return;
    }
    const [sym, def] = result.value;

    const edit = new WorkspaceEdit();
    switch (sym.kind) {
      case SymbolKind.Class:
      case SymbolKind.Interface:
      case SymbolKind.Module:
        const grouped = targets.reduce<{ [file: string]: Location[] }>((acc, next) => {
          if (!acc[next.uri.toString()]) {
            acc[next.uri.toString()] = [];
          }
          acc[next.uri.toString()].push(next);
          return acc;
        }, {});

        for (const [, locations] of Object.entries(grouped)) {
          const doc = await workspace.openTextDocument(locations[0].uri);
          for (const location of locations) {
            const selection = doc.getText(location.range);
            const startPos = selection.indexOf(sym.name);

            if (startPos === -1) {
              continue;
            }

            let newRange = location.range;
            if (startPos > 0) {
              newRange = new Range(newRange.start.translate(0, startPos), newRange.end);
            }

            edit.replace(location.uri, newRange, newName);
          }
        }

        if (def.uri.scheme !== 'untitled') {
          const newPath = path.format({
            dir: path.dirname(def.uri.path),
            name: newName,
            ext: '.php',
          });
          edit.renameFile(def.uri, def.uri.with({ path: newPath }));
        }

        return edit;
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
          JSON.stringify(target) === JSON.stringify(def) ? `$${normarized}` : normarized,
        );

        continue;
      }

      edit.replace(target.uri, target.range, newName);
    }

    return edit;
  }
}

// TODO vendor pathはcomposer.jsonを参照するように
// http://tadasy.hateblo.jp/entry/2013/10/09/193415
const onVendor = (x: Location) =>
  (workspace.workspaceFolders || []).map(({ uri }) => `${uri.path}/vendor`).some((vp) => x.uri.path.includes(vp));

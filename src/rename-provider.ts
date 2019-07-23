import * as path from 'path';
import {
  Location,
  Position,
  Range,
  RenameProvider,
  SymbolKind,
  TextDocument,
  WorkspaceEdit,
  workspace,
  Uri,
} from 'vscode';
import { getReferences, getSymbol } from './api';
import { isNone } from 'fp-ts/lib/Option';

const COMPOSER_JSON_FILENAME = 'composer.json';
const DEFAULT_VENDOR_DIR = 'vendor';

const onVendor = async (x: Location | Uri) => {
  const uri = x instanceof Uri ? x : x.uri;

  for (const folder of (workspace.workspaceFolders || [])) {
    const found = await workspace.findFiles(`${folder.uri.path}/${COMPOSER_JSON_FILENAME}`);
    if (found.length === 0) {
      continue;
    }
    const composerJson = JSON.parse((await workspace.openTextDocument(found.pop()!.path)).getText());

    // see: https://getcomposer.org/doc/06-config.md#vendor-dir
    const config = composerJson.config || {};
    if (uri.path.includes(`${folder.uri.path}/${config['vendor-dir'] || DEFAULT_VENDOR_DIR}`)) {
      return true;
    }
  }

  return false;
};

const prepareRename: RenameProvider['prepareRename'] = async (doc, pos) => {
  if (await onVendor(doc.uri)) {
    throw new Error('You can not rename vendor symbol');
  }

  const result = await getSymbol(doc.uri, pos);
  if (isNone(result)) {
    throw new Error('You can not rename this symbol');
  }
  const [sym, def] = result.value;

  if (await onVendor(def)) {
    throw new Error('You can not rename vendor symbol');
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
};

const provideRenameEdits: RenameProvider['provideRenameEdits'] = async (
  doc: TextDocument,
  pos: Position,
  newName: string,
) => {
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
    if (await onVendor(target)) {
      continue;
    }

    if (sym.kind === SymbolKind.Property) {
      // e.g. $foo -> foo
      // e.g. foo  -> foo
      const normalized = newName.replace(/^\$/, '');

      edit.replace(
        target.uri,
        target.range,
        JSON.stringify(target) === JSON.stringify(def) ? `$${normalized}` : normalized,
      );

      continue;
    }

    edit.replace(target.uri, target.range, newName);
  }

  return edit;
};

export const renameProvider = { prepareRename, provideRenameEdits };

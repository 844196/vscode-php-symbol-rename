import { ExtensionContext, languages } from 'vscode';
import { PhSymbolpRenameProvider } from './rename-provider';

const activate = (ctx: ExtensionContext) => {
  ctx.subscriptions.push(languages.registerRenameProvider('php', new PhSymbolpRenameProvider()));
  console.log('vscode-php-symbol-rename is active');
};

const deactivate = () => undefined;

export { activate, deactivate };

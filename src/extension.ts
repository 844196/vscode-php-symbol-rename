import { ExtensionContext, languages } from 'vscode';
import { renameProvider } from './rename-provider';

const activate = (ctx: ExtensionContext) => {
  ctx.subscriptions.push(languages.registerRenameProvider('php', renameProvider));
  console.log('vscode-php-symbol-rename is active');
};

const deactivate = () => undefined;

export { activate, deactivate };

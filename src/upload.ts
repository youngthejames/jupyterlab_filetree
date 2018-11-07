import { ToolbarButton, showErrorMessage } from '@jupyterlab/apputils';

import { FileBrowserModel } from '@jupyterlab/filebrowser';


export class Uploader extends ToolbarButton {

  private _input = Private.createUploadInput();

  private fileBrowserModel: FileBrowserModel;
  
  constructor(options: any) {
    super({
      iconClassName: 'jp-FileUploadIcon jp-Icon jp-Icon-16',
      onClick: () => {
        this._input.click();
      },
      tooltip: 'Upload Files'
    });
    this.fileBrowserModel = new FileBrowserModel({'manager': options.manager});
    this._input.onclick = this._onInputClicked;
    this._input.onchange = this._onInputChanged;
    this.addClass('jp-id-upload');
  }

  private _onInputChanged = () => {
    let files = Array.prototype.slice.call(this._input.files) as File[];
    let pending = files.map(file => this.fileBrowserModel.upload(file));
    Promise.all(pending).catch(error => {
      showErrorMessage('Upload Error', error);
    });
  };

  private _onInputClicked = () => {
    // In order to allow repeated uploads of the same file (with delete in between),
    // we need to clear the input value to trigger a change event.
    this._input.value = '';
  };
}

namespace Private {

  export function createUploadInput(): HTMLInputElement {
    let input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    return input;
  }

}

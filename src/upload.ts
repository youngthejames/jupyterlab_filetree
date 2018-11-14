import { ToolbarButton, showErrorMessage, Dialog, showDialog } from '@jupyterlab/apputils';

// import { FileBrowserModel } from '@jupyterlab/filebrowser';

import { Contents } from '@jupyterlab/services';

import { PageConfig, IChangedArgs } from '@jupyterlab/coreutils';

import { ArrayExt } from '@phosphor/algorithm';

import { Signal } from '@phosphor/signaling';

import {
  IDocumentManager,
  shouldOverwrite
} from '@jupyterlab/docmanager';

import {
  FileTreeWidget
} from './index';

/**
 * The maximum upload size (in bytes) for notebook version < 5.1.0
 */
export const LARGE_FILE_SIZE = 15 * 1024 * 1024;

export const CHUNK_SIZE = 1024 * 1024;

export interface IUploadModel {
  path: string;
  /**
   * % uploaded [0, 1)
   */
  progress: number;
}

export class Uploader extends ToolbarButton {

  private _input = Private.createUploadInput();
  private _uploads: IUploadModel[] = [];
  private _uploadChanged = new Signal<this, IChangedArgs<IUploadModel>>(this);

  //private fileBrowserModel: FileBrowserModel;
  private manager: IDocumentManager;
  private widget: FileTreeWidget;
  private context: string;
  
  constructor(options: any) {
    super({
      iconClassName: 'jp-FileUploadIcon jp-Icon jp-Icon-16',
      onClick: () => {
        this.context = '';
        this._input.click();
      },
      tooltip: 'Upload Files'
    });
    //this.fileBrowserModel = new FileBrowserModel({'manager': options.manager});
    this.manager = options.manager;
    this.widget = options.widget;
    this._input.onclick = this._onInputClicked;
    this.context = '';
    this._input.onchange = this._onInputChanged;
    this.addClass('filetree-upload');
  }

  contextClick(path: string) {
    this.context = path;
    this._input.click();
  }

  private _onInputChanged = () => {
    let files = Array.prototype.slice.call(this._input.files) as File[];
    let pending = files.map(file => this.upload(file, this.context));
    this.context = '';
    Promise.all(pending).catch(error => {
      showErrorMessage('Upload Error', error);
    });
  };

  private _onInputClicked = () => {
    // In order to allow repeated uploads of the same file (with delete in between),
    // we need to clear the input value to trigger a change event.
    this._input.value = '';
  };

  private _uploadCheckDisposed(): Promise<void> {
    if (this.isDisposed) {
      return Promise.reject('Filemanager disposed. File upload canceled');
    }
    return Promise.resolve();
  }

  /**
   * Upload a `File` object.
   *
   * @param file - The `File` object to upload.
   *
   * @returns A promise containing the new file contents model.
   *
   * #### Notes
   * On Notebook version < 5.1.0, this will fail to upload files that are too
   * big to be sent in one request to the server. On newer versions, it will
   * ask for confirmation then upload the file in 1 MB chunks.
   */
  async upload(file: File, path: string): Promise<Contents.IModel> {
    const supportsChunked = PageConfig.getNotebookVersion() >= [5, 1, 0];
    const largeFile = file.size > LARGE_FILE_SIZE;

    if (largeFile && !supportsChunked) {
      let msg = `Cannot upload file (>${LARGE_FILE_SIZE / (1024 * 1024)} MB). ${
        file.name
      }`;
      console.warn(msg);
      throw msg;
    }

    const err = 'File not uploaded';
    if (largeFile && !(await this._shouldUploadLarge(file))) {
      throw 'Cancelled large file upload';
    }
    await this._uploadCheckDisposed();
    await this.widget.refresh();
    await this._uploadCheckDisposed();

    let contents = await this.widget.cm.get(this.context);
    contents.content.forEach(async (entry: any) => {
      if ((entry.name === file.name) && !(await shouldOverwrite(file.name)))
        throw err;
    });
    await this._uploadCheckDisposed();

    const chunkedUpload = supportsChunked && file.size > CHUNK_SIZE;
    return await this._upload(file, path, chunkedUpload);
  }

  private async _shouldUploadLarge(file: File): Promise<boolean> {
    const { button } = await showDialog({
      title: 'Large file size warning',
      body: `The file size is ${Math.round(
        file.size / (1024 * 1024)
      )} MB. Do you still want to upload it?`,
      buttons: [Dialog.cancelButton(), Dialog.warnButton({ label: 'UPLOAD' })]
    });
    return button.accept;
  }

  /**
   * Perform the actual upload.
   */
  private async _upload(file: File, path_arg: string, chunked: boolean): Promise<Contents.IModel> {
    // Gather the file model parameters.
    let path = path_arg || '';
    path = path ? path + '/' + file.name : file.name;
    let name = file.name;
    let type: Contents.ContentType = 'file';
    let format: Contents.FileFormat = 'base64';

    const uploadInner = async (
      blob: Blob,
      chunk?: number
    ): Promise<Contents.IModel> => {
      await this._uploadCheckDisposed();
      let reader = new FileReader();
      reader.readAsDataURL(blob);
      await new Promise((resolve, reject) => {
        reader.onload = resolve;
        reader.onerror = event =>
          reject(`Failed to upload "${file.name}":` + event);
      });
      await this._uploadCheckDisposed();

      // remove header https://stackoverflow.com/a/24289420/907060
      const content = (reader.result as string).split(',')[1];

      let model: Partial<Contents.IModel> = {
        type,
        format,
        name,
        chunk,
        content
      };
      return await this.manager.services.contents.save(path, model);
    };

    if (!chunked) {
      try {
        return await uploadInner(file);
      } catch (err) {
        ArrayExt.removeFirstWhere(this._uploads, uploadIndex => {
          return file.name === uploadIndex.path;
        });
        throw err;
      }
    }

    let finalModel: Contents.IModel;

    let upload = { path, progress: 0 };
    this._uploadChanged.emit({
      name: 'start',
      newValue: upload,
      oldValue: null
    });

    for (let start = 0; !finalModel; start += CHUNK_SIZE) {
      const end = start + CHUNK_SIZE;
      const lastChunk = end >= file.size;
      const chunk = lastChunk ? -1 : end / CHUNK_SIZE;

      const newUpload = { path, progress: start / file.size };
      this._uploads.splice(this._uploads.indexOf(upload));
      this._uploads.push(newUpload);
      this._uploadChanged.emit({
        name: 'update',
        newValue: newUpload,
        oldValue: upload
      });
      upload = newUpload;

      let currentModel: Contents.IModel;
      try {
        currentModel = await uploadInner(file.slice(start, end), chunk);
      } catch (err) {
        ArrayExt.removeFirstWhere(this._uploads, uploadIndex => {
          return file.name === uploadIndex.path;
        });

        this._uploadChanged.emit({
          name: 'failure',
          newValue: upload,
          oldValue: null
        });

        throw err;
      }

      if (lastChunk) {
        finalModel = currentModel;
      }
    }

    this._uploads.splice(this._uploads.indexOf(upload));
    this._uploadChanged.emit({
      name: 'finish',
      newValue: null,
      oldValue: upload
    });

    return finalModel;
  }

}

namespace Private {

  export function createUploadInput(): HTMLInputElement {
    let input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    return input;
  }

}

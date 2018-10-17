import {
  JupyterLab, JupyterLabPlugin, ILayoutRestorer
} from '@jupyterlab/application';

import {
  ContentsManager
} from '@jupyterlab/services';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  IThemeManager
} from '@jupyterlab/apputils';

import {
  Widget
} from '@phosphor/widgets';

import '../style/index.css';

class FileTreeWidget extends Widget {
  cm: ContentsManager;
  dr: DocumentRegistry;
  commands: any;
  table: HTMLElement;
  controller: any;

  constructor(lab: JupyterLab) {
    super();

    this.id = 'filetree-jupyterlab';
    this.title.iconClass = 'filetree-icon';
    this.title.caption= 'File Tree';
    this.title.closable = true;
    this.addClass('jp-filetreeWidget');

    this.cm = lab.serviceManager.contents;
    this.dr = lab.docRegistry;
    this.commands = lab.commands;
    this.controller = {};

    let base = this.cm.get('');
    base.then((res) => {
      var table = this.buildTable(['File Name'], res.content);
      this.node.appendChild(table);
    });
  }

  buildTable(headers: any, data: any) {
    let table = document.createElement('table');
    table.className = 'filetree-head';
    let thead = table.createTHead();
    let tbody = table.createTBody();
    tbody.id = 'filetree-body';
    let headRow = document.createElement('tr');
    headers.forEach(function(el: string) {
      let th = document.createElement('th');
      th.appendChild(document.createTextNode(el));
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    this.table = tbody;
    this.buildTableContents(data, 1, '');

    table.appendChild(tbody);

    return table;
  }

  buildTableContents(data: any, level: number, parent: any) {
  	let commands = this.commands
    for(var index in data) {
	  let entry = data[index];
      let tr = this.createTreeElement(entry, level);

      if (entry.type === 'directory') {
        tr.onclick = function() { commands.execute('filetree:toggle', {'row': entry.path, 'level': level+1}); }
        this.controller[entry.path] = false;
      } else {
        tr.onclick = function() { commands.execute('docmanager:open', {'path': entry.path}); } 
      }

      if(level === 1)
	    this.table.appendChild(tr);
      else
	    parent.after(tr);
    }
  }

  toggleFolder(row: any, newLevel: number) {
  	this.commands.execute('filetree:toggle');
  	console.log(this);

  }

  createTreeElement(object: any, level: number) {
	let tr = document.createElement('tr');
    let td = document.createElement('td');

    let icon = document.createElement('span');
    icon.className = 'jp-DirListing-itemIcon ';
    if(object.type === 'directory')
      icon.className += this.dr.getFileType('directory').iconClass;
    else {
      var iconClass = this.dr.getFileTypesForPath(object.path);
      if (iconClass.length == 0)
      	icon.className += this.dr.getFileType('text').iconClass;
      else
      	icon.className += this.dr.getFileTypesForPath(object.path)[0].iconClass;
    }
    
    td.appendChild(icon);  
    let title = document.createElement('span');
    title.innerHTML = object.name;
    td.appendChild(title);
    td.className = 'filetree-item-text'; 
    td.style.setProperty('--indent', level + 'em');

    tr.appendChild(td);
    tr.className = 'filetree-item';
    tr.id = object.path;

    return tr;
  }

}

function switchView(mode: any) {
  if(mode == "none") return "";
  else return "none"
}

function activate(app: JupyterLab, restorer: ILayoutRestorer, themeManager: IThemeManager) {
  console.log('JupyterLab extension jupyterlab_filetree is activated!');

  let widget = new FileTreeWidget(app);
  restorer.add(widget, 'filetree-jupyterlab');
  app.shell.addToLeftArea(widget);

  // if(themeManager.isLight(themeManager.theme))
  //   console.log('Light theme detected - switching icons');

  // console.log(app.docRegistry.fileTypes());
  // //console.log(app.docRegistry.getFileTypesForPath('jupyterlab_filetree/tsconfig.json')[0].iconClass);

  const toggle_command: string = 'filetree:toggle';
  app.commands.addCommand(toggle_command, {
    execute: args => {
      let row = args['row'] as string;
      let level = args['level'] as number;

      var row_element = document.getElementById(row);

      if(row_element.nextElementSibling.id.startsWith(row)) { // next element in folder, already constructed
      	var display = switchView(document.getElementById(row_element.nextElementSibling.id).style.display);
      	widget.controller[row] = !(widget.controller[row])
      	var open_flag = widget.controller[row];
      	// open folder
        while (row_element.nextElementSibling.id.startsWith(row)) {
      	  row_element = document.getElementById(row_element.nextElementSibling.id);
      	  // check if the parent folder is open
      	  if(!(open_flag) || widget.controller[row_element.id.substring(0,row_element.id.lastIndexOf('/'))]) 
          	row_element.style.display = display;
        }
      } else { // if children elements don't exist yet
        let base = app.serviceManager.contents.get(row);
        base.then(res => {
          widget.buildTableContents(res.content, level, row_element);
        });
        widget.controller[row] = true;
      }
    }
  });
}

const extension: JupyterLabPlugin<void> = {
  id: 'jupyterlab_filetree',
  autoStart: true,
  requires: [ILayoutRestorer, IThemeManager],
  activate: activate
};

export default extension;

import {
  JupyterLab, JupyterLabPlugin, ILayoutRestorer
} from '@jupyterlab/application';

import {
  Widget
} from '@phosphor/widgets';

import '../style/index.css';

var FILES = {'jupyter': { 'permissions.hjson': '', 'appdefs': {'core': {'appdef.hjson': ''}}}}

class FileTreeWidget extends Widget {
  constructor() {
    super();

    this.id = 'filetree-jupyterlab';
    this.title.iconClass = 'filetree-icon'
    this.title.caption= 'File Tree';
    this.title.closable = true;
    this.addClass('jp-filetreeWidget');
  }
}

function switchView(mode: any) {
  if(mode == "none") return "";
  else return "none"
}

function toggleFolder(row: any, parent: any) {
  let children = parent.children;
  for(let i = 0; i < children.length; i++) {
	if(children[i] != row) {
	  children[i].style.display = switchView(children[i].style.display);
	}
  }
}

function buildTableContents(body: any, data: any, level: number) {
  Object.keys(data).forEach(key => {
    let tr = document.createElement('tr');
    let td = document.createElement('td');

    let icon = document.createElement('span');
    icon.className = 'jp-DirListing-itemIcon jp-MaterialIcon ';
    if(typeof data[key] !== 'string')
      icon.className += 'jp-OpenFolderIcon';
    else
      icon.className += 'jp-FileIcon';
    
    td.appendChild(icon);  
    let title = document.createElement('span')
    title.innerText = key;
    td.appendChild(title);    
    td.className = 'filetree-item-text'; 
    td.style.setProperty('--indent', level + 'em');

    tr.appendChild(td);
    tr.className = 'filetree-item';

    if(typeof data[key] !== 'string') {
      var tbody = document.createElement('tbody');
      tbody.appendChild(tr);
      tr.onclick = function() { toggleFolder(tr, tbody); }
      buildTableContents(tbody, data[key], level+1);
      body.appendChild(tbody);
    } else {
      body.appendChild(tr);
    }
  });
}

function buildTable(data: any) {
  let table = document.createElement('table');
  table.className = 'filetree-head'
  let thead = table.createTHead();
  let tbody = table.createTBody();
  let headRow = document.createElement('tr');
  ['File Name'].forEach(function(el) {
    let th = document.createElement('th');
    th.appendChild(document.createTextNode(el));
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  buildTableContents(tbody, data, 1);
  table.appendChild(tbody);

  return table;
}

function activate(app: JupyterLab, restorer: ILayoutRestorer) {
  console.log('JupyterLab extension jupyterlab_filetree is activated!');
  
  let widget = new FileTreeWidget();
  restorer.add(widget, 'filetree-jupyterlab');

  let header = document.createElement('header');
  header.textContent = 'File Tree';
  widget.node.appendChild(header);

  let table = buildTable(FILES);
  widget.node.appendChild(table);

  app.shell.addToLeftArea(widget);
}

/**
 * Initialization data for the jupyterlab_changeset extension.
 */
const extension: JupyterLabPlugin<void> = {
  id: 'jupyterlab_filetree',
  autoStart: true,
  requires: [ILayoutRestorer],
  activate: activate
};

export default extension;

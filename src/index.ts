import {
  JupyterLab, JupyterLabPlugin, ILayoutRestorer
} from '@jupyterlab/application';

import {
  Widget
} from '@phosphor/widgets';

import '../style/index.css';

class FileTreeWidget extends Widget {
  constructor() {
    super();

    this.id = 'filetree-jupyterlab';
    this.title.iconClass = 'filetree-icon';
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
	if(children[i].id.startsWith(row.id) && children[i] != row) {
	  children[i].style.display = switchView(children[i].style.display);
	}
  }
}

function buildTableContents(body: any, data: any, level: number, parent: string) {
  Object.keys(data).forEach(key => {
    let tr = document.createElement('tr');
    let td = document.createElement('td');

    let icon = document.createElement('span');
    icon.className = 'jp-DirListing-itemIcon jp-MaterialIcon ';
    if(!(data[key] instanceof Array))
      icon.className += 'jp-OpenFolderIcon';
    else
      icon.className += 'jp-FileIcon';
    
    td.appendChild(icon);  
    let title = document.createElement('span');
    title.innerHTML = key;
    td.appendChild(title);
    td.className = 'filetree-item-text'; 
    td.style.setProperty('--indent', level + 'em');

    tr.appendChild(td);
    tr.className = 'filetree-item';
    tr.id = parent + '-' + key

    if (!(data[key] instanceof Array)) {
      tr.onclick = function() { toggleFolder(tr, body); }
      body.appendChild(tr);
      buildTableContents(body, data[key], level+1, tr.id);
    } else {
      tr.onclick = function() {console.log('open file');}
      for (var value in data[key]) {
        var temp = document.createElement('td');
        temp.innerHTML = data[key][value];
        tr.appendChild(temp);
      }
      body.appendChild(tr);
    }
  });
}

function buildTable(headers: any, data: any) {
  let table = document.createElement('table');
  table.className = 'filetree-head'
  let thead = table.createTHead();
  let tbody = table.createTBody();
  let headRow = document.createElement('tr');
  headers.forEach(function(el: string) {
    let th = document.createElement('th');
    th.appendChild(document.createTextNode(el));
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  buildTableContents(tbody, data, 1, '');

  table.appendChild(tbody);

  return table;
}

function activate(app: JupyterLab, restorer: ILayoutRestorer) {
  console.log('JupyterLab extension jupyterlab_filetree is activated!');
  
  let widget = new FileTreeWidget();
  restorer.add(widget, 'filetree-jupyterlab');

  function callback(resp: any) {
      var table = buildTable(resp['meta'], resp['files']);
      widget.node.appendChild(table);
  }

  let xmlHttp = new XMLHttpRequest();
  xmlHttp.onreadystatechange = function() {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
      callback(JSON.parse(xmlHttp.responseText));
  }
  xmlHttp.open('GET', '/file_tree', true);
  xmlHttp.withCredentials = true;
  xmlHttp.send();

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

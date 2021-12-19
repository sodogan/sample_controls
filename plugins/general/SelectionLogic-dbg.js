/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([ "retail/pmr/promotionaloffers/utils/Utils" ], function(Utils) {

	function groupPaths(arrays) {
		if (arrays.length === 0) {
			return [];
		}

		var max = arrays.reduce(function(a, b) {
			return Math.max(a, b.length);
		}, Number.MIN_VALUE);

		var result = [];
		for (var i = 0; i < max; i++) {
			var currentItem = [];
			for (var j = 0; j < arrays.length; j++) {
				var currentArray = arrays[j];
				currentItem.push(currentArray[currentArray.length - i - 1]);
			}
			result.unshift(currentItem);
		}
		return result;
	}

	function getCommonPath(paths) {
		if (paths.length === 0) {
			return [];
		}
		var allPaths = groupPaths(paths);
		var commonParent = Utils.find(Utils.allEqual, allPaths);
		if (!commonParent) {
			return null;
		}
		var commonPaths = Utils.takeWhile(Utils.not(Utils.allEqual), allPaths);
		return Utils.unique(Utils.concatAll(commonPaths)).concat(commonParent[0]);
	}

	function getId(item) {
		return item.N_ID;
	}

	function getParentId(item) {
		return item.P_ID;
	}

	
	function isLocation(node) {
		return node.hasOwnProperty("LocationId");
	}
	
	/**
	 * sets state of given node and all children as 'checked'
	 * 
	 * @param index -
	 *            the indexed tree
	 * @param selectedId -
	 *            selected node id (N_ID)
	 * @param checked -
	 *            true or false
	 * @returns Array [N_ID] - all the nodes that were affected by the toggle
	 */
	function setNodeState(index, selectedId, checked) {
		var node = index[selectedId];
		var changes = [];
		Utils.walk(node, function(i) {
			if(i.closed){
				i.checked = false;
				changes.push(getId(i));
			} else {
				i.checked = checked;
				changes.push(getId(i));
			}
		});

		return changes;
	}
	/**
	 * 
	 * @param index
	 * @returns Array [node] - all currently selected N_IDs
	 */
	function getSelectedIds(index) {
		return index.currentSelection.concat([]);
	}

	/**
	 * 
	 * @param id
	 * @param index
	 * @returns Array [N_ID] paths to top most root from given N_ID
	 */
	function pathToRoot(id, index) {
		var result = [];
		var node = index[id];
		var parentId = getParentId(node);
		while (parentId !== undefined && parentId !== null) {
			var pid = getParentId(node);
			result.push(pid);
			node = index[pid];
			parentId = getParentId(node);
		}

		// if no path, then it is its own parrent
		if (result.length === 0) {
			result.push(id);
		}

		return result;
	}
	
	/**
	 * selects common parent node
	 * 
	 * @param oldIds -
	 *            old selection
	 * @param newIds -
	 *            newly selected items
	 * @param index -
	 *            the tree in index form
	 * @returns Array [N_ID] - current selections
	 */
	function selectParents(oldIds, newIds, index) {
		var oldChildren = oldIds.filter(function(id) {
			return children(index[id]).length === 0;
		});
		var pathsToRoot = oldChildren.concat(newIds).map(function(id) {
			return pathToRoot(id, index);
		});

		var commonParents = getCommonPath(pathsToRoot);

		var selections = newIds;

		if (commonParents) {
			commonParents.forEach(function(id) {
				index[id].checked = true;
				selections.push(id);
			});
			selections = selections.concat(oldIds);
		} else {
			oldIds.forEach(function(id) {
				index[id].checked = false;
			});
			newIds.forEach(function(id) {
				var item = index[id];
				var pid = getParentId(item);
				if (item.LocationId && index[pid]) {
					index[pid].checked = true;
					selections.push(pid);
					selections.push(id);
				}
			});
		}

		return selections;

	}

	function getNodeId(item) {
		return item.NodeId || item.LocationId;
	}

	/**
	 * creates a map from node id (N_ID) to respective subtree
	 * 
	 * @param tree
	 * @returns - Map [Int, Node] - the index
	 */
	function buildIndex(tree, includedIds, excludedIds, offerInterval) {
		var result = {};
		var currentSelection = [];
		var idCounter = 0;
		var startOfOffer = offerInterval ? offerInterval.StartOfOffer : null;
		var endOfOffer = offerInterval ? offerInterval.EndOfOffer : null;
		for (var i = 0; i < tree.length; i++) {
			Utils.walk(tree[i], function(node, parent) {
				node.N_ID = idCounter;
				node.P_ID = (parent || {}).N_ID;
				var id = getId(node);
				var nodeId = getNodeId(node);
				if(Utils.isClosed(node, startOfOffer, endOfOffer)){
					node.closed = true;
					excludedIds.push(getId(node));
				}
				if (includedIds.indexOf(nodeId) >= 0) {
					Utils.walk(node, function(node) {
						node.checked = true;
					});
				}
				if (excludedIds.indexOf(nodeId) >= 0) {
					Utils.walk(node, function(node) {
						node.checked = false;
					});
				}				
				if (node.closed) {
					node.checked = false;
				}
				result[id] = node;
				if (node.checked) {
					currentSelection.push(id);
				}
				idCounter++;
			});
		}

		result.currentSelection = currentSelection;
		return result;
	}

	/**
	 * 
	 * @param node
	 * @returns Array [node] - all children of given node
	 */
	function children(node) {
		var result = [];
		for ( var i in node) {
			if (node.hasOwnProperty(i) && jQuery.isNumeric(i)) {
				result.push(i);
			}
		}
		return result;
	}
	/**
	 * selects node and all sub nodes. selects parent node if node is location
	 * selects common parent if other selections are present
	 * 
	 * @param selectedNode
	 * @param index
	 * @returns undefined
	 */
	function select(selectedNode, index) {		
		if(!selectedNode.closed){
			var currentSelections = getSelectedIds(index);
			var newSelections = setNodeState(index, getId(selectedNode), true);
	
			var hasSelections = currentSelections.length > 0 && newSelections.length > 0;
	
			var selections = newSelections.concat(currentSelections);
			if (hasSelections || isLocation(selectedNode)) {
				var extraSelections = selectParents(currentSelections, newSelections, index);
				selections = newSelections.concat(extraSelections);
			}
	
			index.currentSelection = Utils.unique(selections);
		} else {
			selectedNode.checked = false;
		}
	}

	/**
	 * deselects the given node and all subnodes. deselects parent node if there
	 * is only one selected node left under that parent
	 * 
	 * @param selectedNode
	 * @param index
	 * @returns undefined
	 */
	function deselect(selectedNode, index) {
		var selectedId = getId(selectedNode);
		var deselect = {};

		//deselect node and childrens
		Utils.walk(selectedNode, function(i) {
			i.checked = false;
			deselect[getId(i)] = true;
		});
		var node = index[getId(selectedNode)];
		node.checked = false;
		deselect[getId(node)] = true;
		
		while(Utils.notNull(index[getParentId(node)])){			
			if(shouldDeselectParent(node, index)){
				index[getParentId(node)].checked = false;
				deselect[getId(index[getParentId(node)])] = true;
			}			
			node = index[getParentId(node)];
		}

		//remove all deselected from currentSelection
		index.currentSelection = index.currentSelection.filter(function(item){
			return !deselect[item];
		});
		
	}
	
	/**
	 * decides if the parent should be deselected,
	 * if all brothers of the parent are deselected it should deselect the parent
	 * 
	 * @param node
	 * @param index
	 * @returns
	 */
	function shouldDeselectParent(node, index){
		var deselectParent = true;
		if(Utils.notNull(getParentId(index[getId(node)]))){
			var parent = index[getParentId(index[getId(node)])];	
			
			var brotherCounter = 0;
			//check on childrens
			for(var i in parent){
				if(parent.hasOwnProperty(i) && jQuery.isNumeric(i)){
					if(parent[i].checked){
						deselectParent = false;
						brotherCounter++;
					}
				}
			}
			if(brotherCounter === 0){				
				return true;
			}
			if(Utils.notNull(getParentId(parent))){
				shouldDeselectParent(parent, index);
			} else {
				if(node.NodeId && brotherCounter === 1){				
					return true;
				}  
				if(deselectParent){
					return true;
				}		
			}
		} else {
			return false;
		}
	}
	
	/**
	 * executes the selection logic
	 * 
	 * @param node -
	 *            selected node
	 * @param index -
	 *            indexed tree (hashmap of N_ID to subtree)
	 * @param checked -
	 *            select or deselect
	 * @returns undefined
	 */
	function runSelection(node, index, checked) {
		if (checked) {
			select(node, index);
		} else {
			deselect(node, index);
		}
	}
	/**
	 * 
	 * @param items
	 * @returns true if any item has checked === true false otherwise
	 */
	function anyChecked(items) {
		return items.some(function(i) {
			return i.checked;
		});
	}

	/**
	 * 
	 * @param a -
	 *            Array [any]
	 * @param b -
	 *            Array [any]
	 * @returns return <0 if a.length < b.length, 0 if a.length === b.length, >0
	 *          if a.length > b.length
	 */
	function arrayLengthComparator(a, b) {
		return a.length - b.length;
	}

	/**
	 * returns a mapping function that maps id to { id : <id>, checked : true |
	 * false}
	 * 
	 * @param index
	 * @returns
	 */
	function pathToCurrentSelectionWithChecked(index) {

		function withChecked(index) {
			return function(id) {
				return {
					checked : index[id].checked || false,
					id : id
				};
			};
		}

		return function(id) {
			return pathToRoot(id, index).map(withChecked(index));
		};
	}
	/**
	 * 
	 * @param index
	 * @returns the N_ID of top most selected node
	 */
	function getSelectedRootId(index) {
		var currentSelection = index.currentSelection;
		if (currentSelection.length <= 1) {
			return currentSelection[0];
		}
		var pathsToRoot = currentSelection
				.map(pathToCurrentSelectionWithChecked(index))
				.filter(anyChecked)
				.sort(arrayLengthComparator);
		
		return pathsToRoot[0][0].id;
	}
	
	/**
	 * 
	 * @param rootNode
	 * @param index
	 * @returns - all unchecked N_IDs from given node
	 */
	function getExcludedIds(rootNode, index) {
		var rootNode = index[rootNode];
		var result = [];
		Utils.walk(rootNode, function(i) {
			if (!i.checked) {
				result.push(getId(i));
			}
		});
		return result;
	}

	function SelectionLogic(tree, includedNodes, excludedNodes, offerInterval) {
		this.index = buildIndex(tree, includedNodes || [], excludedNodes || [], offerInterval);
		this.tree = tree;
	}

	SelectionLogic.prototype.runSelection = function(node, checked) {
		runSelection(node, this.index, checked);
		return this.tree;
	};

	SelectionLogic.prototype.getSelection = function() {
		var index = this.index;
		var rootNodeId = getSelectedRootId(index);
		if (rootNodeId === null || rootNodeId === undefined) {
			return {
				selection : null,
				exclusions : []
			};
		}

		var exclusions = getExcludedIds(rootNodeId, index).map(function(id) {
			return index[id];
		});

		return {
			selection : index[rootNodeId],
			exclusions : exclusions
		};
	};

	SelectionLogic.prototype.getById = function(id) {
		return this.index[id];
	};
	
	return SelectionLogic;

}, true);
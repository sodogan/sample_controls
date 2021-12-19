/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/m/ComboBox",
	"sap/m/ComboBoxRenderer",
	"sap/ui/core/Item",
], function (ComboBox, ComboBoxRenderer, Item) {
	"use strict";
	var SECOND_LEVEL_IDENTIFIER = "SecondLevel";
	var PARENT_IDENTIFIER = "isParent";

    /* For sap.ui.version >= 1.62.0, the list structure of the ComboBox control is sap.m.List, instead of sap.m.SelectList  */
	
	if (sap.ui.version >= "1.62.0") {
		var ListHierarchy = sap.m.List.extend("retail.pmr.promotionaloffers.utils.controls.ListHierarchy", {
			renderer: sap.m.ListRenderer.render,
			onAfterRendering: function() {
			var aItems = this.getItems() || [];
			var oComboBox = this._oComboBox;
			for(var i = 0, iLen = aItems.length; i < iLen; i++) {
				if(oComboBox._getItemByListItem(aItems[i]).data(SECOND_LEVEL_IDENTIFIER)) {
					aItems[i].$().css("text-indent", "1.5rem");
				} else if(oComboBox._getItemByListItem(aItems[i]).data(PARENT_IDENTIFIER)) {
					aItems[i].$().removeClass("sapMSelectListItemBase sapMSelectListItemBaseInvisible sapMSelectListItemBaseDisabled sapMSelectListItemBaseHoverable");
					aItems[i].$().addClass("sapMSelectListItem");
				}
			}

		}
	});

	var HierarchicalComboBox = ComboBox.extend("retail.pmr.promotionaloffers.utils.controls.HierarchicalComboBox",{
		renderer: ComboBoxRenderer.render,
		init : function () {
			// call the init function of the parent
			ComboBox.prototype.init.apply(this, arguments);
			 this._aParentItems = [];
			 this._config = {
					 binding: "TermStyles",
					 parentKey: "Group",
					 parentText: "GroupDescription"
			 };
			 this.aTermStyleItems = [];
		},
		metadata : {
			aggregations : {
				termStyles: { type: "sap.ui.core.Item", multiple: true, singularName: "termStyle", bindable: "bindable" }
			}
		}
	});

	HierarchicalComboBox.prototype.setConfig = function (conf) {
		if(!conf.binding || !conf.parentKey || !conf.parentText) {
			return;
		}
		 this._config = conf;
	};

	HierarchicalComboBox.prototype.addTermStyle = function(oItem) {
		this.addItem(oItem);
		this.aTermStyleItems.push(oItem);
		var oContext = oItem.getBindingContext(this._config.binding);
		if(!oContext) {
			return this;	
		}
		var addParent = function(oData) {
			var parentItem = new sap.ui.core.Item({key:oData[this._config.parentKey], text:oData[this._config.parentText]});
			parentItem.data(PARENT_IDENTIFIER, true);
			parentItem.setEnabled(false);
			this._aParentItems.push(parentItem);
			this.aTermStyleItems.push(parentItem);
			this.addItem(parentItem);
		}.bind(this);
		var oData = {};
		var sPath = oContext.getPath();
		oData = oContext.getModel().getProperty(sPath) || [];
		if(oData[this._config.parentText]) {
			oItem.data(SECOND_LEVEL_IDENTIFIER, oData[this._config.parentKey]);
			if (!this.findItem("key", oData[this._config.parentKey])) {
				addParent(oData);
			}
		}
		this.orderItems();
		return this;
	};
	HierarchicalComboBox.prototype.createList = function() {
		this._oList = new ListHierarchy({
			width: "100%",
			mode: sap.m.ListMode.SingleSelectMaster,
			rememberSelections: false,
			busyIndicatorDelay: 0,
			showSeparators: sap.m.ListSeparators.None
		}).addStyleClass(this.getRenderer().CSS_CLASS_COMBOBOXBASE + "List")
		.addStyleClass(this.getRenderer().CSS_CLASS_COMBOBOX + "List")
		.attachSelectionChange(this.onSelectionChange, this)
		.attachItemPress(this.onItemPress, this);
		
		this._oList._oComboBox = this;
		
		return this._oList;
	};

	HierarchicalComboBox.prototype.getChildrensByParent = function(parent, aItems) {
		var items = [];
		for(var i = 0, iLen = aItems.length; i < iLen; i++) {
			if(!aItems[i].data(PARENT_IDENTIFIER) && aItems[i].data(SECOND_LEVEL_IDENTIFIER) === parent) {
				items.push(aItems[i]);
			}
		}
		return items;
	};

	HierarchicalComboBox.prototype.orderItems = function() {
		var aItems = this.aTermStyleItems;
		var items = [];
		var itemsWithoutParent = [];
		var i, iLen;
		var listOfItems = [];
		for(i = 0, iLen = aItems.length; i < iLen; i++) {
			if(aItems[i].data(PARENT_IDENTIFIER)) {
				items.push(aItems[i]);
				items = items.concat(this.getChildrensByParent(aItems[i].getKey(), aItems));
			}
			if(!aItems[i].data(PARENT_IDENTIFIER) && !aItems[i].data(SECOND_LEVEL_IDENTIFIER)) {
				itemsWithoutParent.push(aItems[i]);
			}
		}
		items = items.concat(itemsWithoutParent);
		for(i = 0, iLen = items.length; i < iLen; i++) {
			listOfItems.push({
				item: items[i],
				index: i
			});
		}
		this.removeAllItems();
		listOfItems.forEach(function(obj){
			this.insertItem(obj.item, obj.index);
		}.bind(this));
	};
	HierarchicalComboBox.prototype.getItems = function() {
		var oList = this.getList();
		var items = [];
		if(oList) {
			var oListItems = this.getAggregation("items", []);
			for(var i = 0, iLen = oListItems.length; i < iLen; i++) {
				if(!oListItems[i].data(PARENT_IDENTIFIER)) {
					items.push(oListItems[i]);
				}
			}
		}
		return items;
	};
	HierarchicalComboBox.prototype.oninput = function(oEvent) {
		var aItems = this._aParentItems;
		for(var i = 0, iLen = aItems.length; i < iLen; i++) {
			if(aItems[i].data(PARENT_IDENTIFIER)) {
				this._setItemVisibility(aItems[i], false);
			}
		}		
		ComboBox.prototype.oninput.apply(this, arguments);
	};

	} else { 
		
		/* For sap.ui.version < 1.62.0, the list structure of the ComboBox control is still sap.m.SelectList  */
		
		jQuery.sap.require ("sap/m/SelectList");
		jQuery.sap.require ("sap/m/SelectListRenderer");
		var SelectList = sap.m.SelectList;
		var SelectListRenderer = sap.m.SelectListRenderer;
		var SelectListHierarchy = SelectList.extend("retail.pmr.promotionaloffers.utils.controls.SelectListHierarchy", {
			renderer: SelectListRenderer.render,
			onAfterRendering: function () {
				var aItems = this.getItems() || [];
				for (var i = 0, iLen = aItems.length; i < iLen; i++) {
					if (aItems[i].data(SECOND_LEVEL_IDENTIFIER)) {
						aItems[i].$().css("text-indent", "1.5rem");
					} else if (aItems[i].data(PARENT_IDENTIFIER)) {
						aItems[i].$().removeClass(
							"sapMSelectListItemBase sapMSelectListItemBaseInvisible sapMSelectListItemBaseDisabled sapMSelectListItemBaseHoverable");
						aItems[i].$().addClass("sapMSelectListItem");
					}
				}

			}
		});

		var HierarchicalComboBox = ComboBox.extend("retail.pmr.promotionaloffers.utils.controls.HierarchicalComboBox", {
			renderer: ComboBoxRenderer.render,
			init: function () {
				// call the init function of the parent
				ComboBox.prototype.init.apply(this, arguments);
				this._aParentItems = [];
				this._config = {
					binding: "TermStyles",
					parentKey: "Group",
					parentText: "GroupDescription"
				};
			},
			metadata: {
				aggregations: {
					termStyles: {
						type: "sap.ui.core.Item",
						multiple: true,
						singularName: "termStyle",
						bindable: "bindable"
					}
				}
			}
		});

		HierarchicalComboBox.prototype.setConfig = function (conf) {
			if (!conf.binding || !conf.parentKey || !conf.parentText) {
				return;
			}
			this._config = conf;
		};

		HierarchicalComboBox.prototype.updateTermStyles = function (sReason) {
			this.destroyItems();
			this.destroyTermStyles();
			this.updateAggregation("termStyles");
		};

		HierarchicalComboBox.prototype.addTermStyle = function (oItem) {
			this.addItem(oItem);
			var oContext = oItem.getBindingContext(this._config.binding);
			if (!oContext) {
				return this;
			}
			var addParent = function (oData) {
				var parentItem = new sap.ui.core.Item({
					key: oData[this._config.parentKey],
					text: oData[this._config.parentText]
				});
				parentItem.data(PARENT_IDENTIFIER, true);
				parentItem.setEnabled(false);
				this._aParentItems.push(parentItem);
				this.addItem(parentItem);
			}.bind(this);
			var oData = {};
			var sPath = oContext.getPath();
			oData = oContext.getModel().getProperty(sPath) || [];
			if (oData[this._config.parentText]) {
				oItem.data(SECOND_LEVEL_IDENTIFIER, oData[this._config.parentKey]);
				if (!this.findItem("key", oData[this._config.parentKey])) {
					addParent(oData);
				}
			}
			this.orderItems();
			return this;
		};


		HierarchicalComboBox.prototype.createList = function () {
			this._oList = new SelectListHierarchy({
					width: "100%"
				}).addStyleClass(this.getRenderer().CSS_CLASS + "List")
				.attachSelectionChange(this.onSelectionChange, this)
				.attachItemPress(this.onItemPress, this);
			return this._oList;
		};

		HierarchicalComboBox.prototype.getChildrensByParent = function (parent, aItems) {
			var items = [];
			for (var i = 0, iLen = aItems.length; i < iLen; i++) {
				if (!aItems[i].data(PARENT_IDENTIFIER) && aItems[i].data(SECOND_LEVEL_IDENTIFIER) === parent) {
					items.push(aItems[i]);
				}
			}
			return items;
		};

		HierarchicalComboBox.prototype.orderItems = function () {
			var aItems = this.getList().getItems();
			this.removeAllItems();
			var items = [];
			var itemsWithoutParent = [];
			var i, iLen;
			for (i = 0, iLen = aItems.length; i < iLen; i++) {
				if (aItems[i].data(PARENT_IDENTIFIER)) {
					items.push(aItems[i]);
					items = items.concat(this.getChildrensByParent(aItems[i].getKey(), aItems));
				}
				if (!aItems[i].data(PARENT_IDENTIFIER) && !aItems[i].data(SECOND_LEVEL_IDENTIFIER)) {
					itemsWithoutParent.push(aItems[i]);
				}
			}
			items = items.concat(itemsWithoutParent);
			for (i = 0, iLen = items.length; i < iLen; i++) {
				this.insertItem(items[i], i);
			}
		};

		HierarchicalComboBox.prototype.getItems = function () {
			var oList = this.getList();
			var items = [];
			if (oList) {
				var oListItems = oList.getItems();
				for (var i = 0, iLen = oListItems.length; i < iLen; i++) {
					if (!oListItems[i].data(PARENT_IDENTIFIER)) {
						items.push(oListItems[i]);
					}
				}
			}
			return items;
		};
		HierarchicalComboBox.prototype.oninput = function (oEvent) {
			var aItems = this._aParentItems;
			for (var i = 0, iLen = aItems.length; i < iLen; i++) {
				if (aItems[i].data(PARENT_IDENTIFIER)) {
					this._setItemVisibility(aItems[i], false);
				}
			}
			ComboBox.prototype.oninput.apply(this, arguments);
		};
	}
	return HierarchicalComboBox;
});
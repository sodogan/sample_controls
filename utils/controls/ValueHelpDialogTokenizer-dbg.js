/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/comp/valuehelpdialog/ValueHelpDialog",
               "sap/m/DialogRenderer"], function(ValueHelpDialog, DialogRenderer){
	return ValueHelpDialog.extend("retail.pmr.promotionaloffers.utils.controls.ValueHelpDialogTokenizer", {

		_callbackRemoveExclude: null,
		_callbackRemoveAllExclude: null,
		_callbackRemoveAllSelected: null,
		_allExcludedTokens: [],
		_allIncludedTokens: [],
		init : function () {
	        // call the init function of the parent
			ValueHelpDialog.prototype.init.apply(this, arguments);
		},
		setHandleRemoveExcludeBtn: function(fCallback) {
			this._callbackRemoveExclude = fCallback;
		},
		setHandleRemoveAllExcludeBtn: function(fCallback) {
			this._callbackRemoveAllExclude = fCallback;
		},
		setHandleRemoveAllSelectedBtn: function(fCallback) {
			this._callbackRemoveAllSelected = fCallback;
		},
		_createTokenizer : function () {
	        // call the init function of the parent
			ValueHelpDialog.prototype._createTokenizer.apply(this, arguments);
			this._oExcludedTokens.attachTokenChange(function(e) {
                if (this._ignoreRemoveToken) {
                    return;
                }
                if (e.getParameter("type") === "removed") {
                  this._callbackRemoveExclude(e);
                }
                this._allExcludedTokens = this._oExcludedTokens.getTokens();
            }.bind(this));
			this._oRemoveAllExcludeItemsBtn.attachPress(function(e) {
				this._callbackRemoveAllExclude(this._allExcludedTokens);
            }.bind(this));
			
			this._oSelectedTokens.attachTokenChange(function(e) {
				if (this._ignoreRemoveToken) {
                    return;
                }
				if (e.getParameter("type") === "removed") {
					this._callbackRemoveAllSelected(e);
	            }
				 this._allIncludedTokens = this._oSelectedTokens.getTokens();
					
			}.bind(this));
			
			this._oRemoveAllSelectedItemsBtn.attachPress(function(e) {
				this._callbackRemoveAllSelected(this._allIncludedTokens);
            }.bind(this));
			
		},
		
		 renderer: DialogRenderer.render,
		 
		 removeAllSelectedTokens: function() {
			 this._oSelectedItems.removeAll();
			 this._oSelectedTokens.destroyTokens();
			 this._updateTitles();
			 this._allIncludedTokens = [];
		 },
		 removeAllExcludedTokens: function() {
			 this._oExcludedTokens.destroyTokens();
			 this._updateTitles();
			 this._allExcludedTokens = [];
		 },
		 removeToken: function(key) {
			 this._removeToken(key);
		 }
		
	});
});
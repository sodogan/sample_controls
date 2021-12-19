/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/m/BusyDialog",
	"sap/ui/core/message/Message",
	"sap/m/MessagePopover",
   	"sap/m/MessagePopoverItem"
	], 
	function(MessageBox, Toast, BusyDialog, Message, MessagePopover, MessagePopoverItem) {
	"use strict";
	
	var _oBusyDialog = null;
	
	var oHandler = {
		
		getMessageManager: function() {
 			return sap.ui.getCore().getMessageManager();
		},
		
		createMessagePopover: function() {
			//Create new message popover
			return new MessagePopover({
				items: {
					path: "/",
					template: new MessagePopoverItem({
						title: "{message}",
						description: "{description}",
						type: "{type}"
					})
				}
			});
		},
		
		showBusy: function(sTitle) {
			_oBusyDialog = new BusyDialog({
				title: sTitle
			});
			_oBusyDialog.open();
		},
		
		hideBusy: function() {
			if (_oBusyDialog) {
				_oBusyDialog.close();
			}
		},
		
		showError: function(sError) {
			MessageBox.error(sError);
		},
		
		showToast: function(sMessage) {
			Toast.show(sMessage, { duration: 3000 });
		},		
		
		numOfErrors: function(oManager) {
			//Determine number of error in message manager
			var oMM = oManager || this.getMessageManager();
			var aMsgs = oMM.getMessageModel().getData();
   			return aMsgs.filter( function(oMsg) { return  oMsg.type === "Error"; } ).length;
		},
		
		numOfMessages: function(oManager) {
			//Determine number of messages in message manager
			var oMM = oManager || this.getMessageManager();
			var aMsgs = oMM.getMessageModel().getData();
			return aMsgs.length;
		},

		handleError: function(oError) {
			//Display error message in a popup
			
			//Log the error
			jQuery.sap.log.error(oError);
			
			var sMessage = "";
			try {
				var body = JSON.parse(oError.response.body);
				sMessage = body.error.message;
			} catch (e) {
				sMessage = oError.message;
			}
			
			this.showError(sMessage);
		},
		
		setErrorMessages: function(oMessageManager, aMessages, oModel) {
			// Add messages to message manager
			var aMsgs = aMessages.map(function(oItem) {
				if (typeof oItem.processor === "undefined") {
					oItem.processor = oModel;
				}
				return new Message(oItem);
			});
			oMessageManager.addMessages(aMsgs);
		},
		
		removeMessagesByPath: function(sPath, oManager) {
			//Remove messages that have matching part
			
			var oMM = oManager || this.getMessageManager();
			var aPathParts = sPath.split("/");
			var aData = oMM.getMessageModel().getData();
			
			aData.forEach(function(oItem) {
				var aTargetParts = oItem.target.split("/");
				var bRemove = aPathParts.every(function(sKey, iIndex) {
					if (aTargetParts[iIndex] !== sKey) {
						return false;
					}
					return true;
				});
				if (bRemove) {
					oMM.removeMessages(oItem);
				}
			});
		},
		
		removeMessagesByPartialPath: function(sPath, oManager) {
			
			var oMM = oManager || this.getMessageManager();
			var aData = oMM.getMessageModel().getData();
			
			aData.forEach( function(oMsg) {
				if(oMsg.target.indexOf(sPath) > -1) {
					oMM.removeMessages(oMsg);
				}	
			});
		},
		
		getFirstMessage: function(oManager) {
			//Retrieve first message from the message manager
			
			var oMM = oManager || this.getMessageManager();
			var aData = oMM.getMessageModel().getData();
			
			if (aData && aData.length > 0) {	
				return aData[0];
			}
		},
  
		errorExistByPartialPath: function(sPath, oManager) {
			
			var oMM = oManager || this.getMessageManager();
			var aData = oMM.getMessageModel().getData();
			var bError = false;
			aData.forEach( function(oMsg) {
				if(oMsg.type === "Error" && oMsg.target.indexOf(sPath) > -1) {
				   bError = true;
				}
			});
			return bError;
		},		
		
		
	};
	
	return oHandler;
	
}, /* bExport= */ true);
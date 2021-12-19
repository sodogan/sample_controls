/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
/*global Promise*/
sap.ui.define(["retail/pmr/promotionaloffers/utils/Models", "retail/pmr/promotionaloffers/utils/Utils"], function(Models, Utils){
   	
   	function CreateService(offerId){
   		this.offerId = offerId;
   	}
   	CreateService.prototype.fetchStaticContent = function(){
		var initialData = Models.getServiceData();
		//Ignore OfferId if fresh statuses are requested (e.g. in Copy)
		var offerId = ( this.freshStatuses !== true ) ? this.offerId : "";
		return Promise.all([initialData,
	                    	Models.getNewOfferStatuses(offerId),
	                    	Models.getMetadataAnalyzer()])
	                  .then(function(responses){
							var response = responses[0];
							var statuses = responses[1];
							
							var data = response.data;
							data.Statuses = statuses;
							data.Terms = data.TermStyles;
							return data;
                  	  }).then(function(data){
                  		  
                  		  return Models.getTactics().then(function (tactics){
                  			  data.Tactics = tactics;
                  			  return data;
                  		  });
                  	  });
	};
	CreateService.prototype.getMasterDataSystem = function(){
		return Models.getMasterDataSystem();
	};
	
	CreateService.prototype.fetchOfferData = function(expands){
		return Models.fetchDefaultValues(expands);
	};
	
	CreateService.prototype.saveOffer = function(payload){
		return Models.createNewOffer(payload);
	};
	
	function EditService(offerId){
		CreateService.call(this, offerId);
		this.path = "/Offers(binary'" + offerId + "')";
	}
	EditService.prototype = Object.create(CreateService.prototype);
	EditService.prototype.saveOffer = function(payload){
		return Models.updateSelectedOffer(payload);
	};
	EditService.prototype.fetchOfferData = function(expands){
		return Models.updateOffer(expands, this.path);
	};
	
	function CopyService(offerId){
		EditService.call(this, offerId);
		this.path += "/Copy";
		this.freshStatuses = true;
	}
	CopyService.prototype = Object.create(EditService.prototype);
	
	
	
	function CreateFromFundsService(vendorFundId){
		CreateService.call(this);
		this.vendorFundId = vendorFundId;
	}
	
	CreateFromFundsService.prototype = Object.create(CreateService.prototype);
	CreateFromFundsService.prototype.fetchOfferData = function(expands){
		return Models.fetchDataForVendorFund(expands, this.vendorFundId);
	};
	
	
	// it does nothing
	function NothingService(){
		return {
			fetchOfferData : function() { return Promise.resolve(); },
			fetchStaticData : function() { return Promise.resolve(); },
			saveOffer : function() { return Promise.resolve(); },
			getMasterDataSystem : function(){
				return Models.getMasterDataSystem();
			}
		};
	}
	
	return {
		get : function createService(name, offerId){
			var param = offerId ? decodeURIComponent(offerId) : "0000000000000000";
			if(name === "create"){
	   			return new CreateService(param);
	   		}
	   		
	   		if(name === "vendorFundsCreate"){
	   			return new CreateFromFundsService(param);
	   		}
			

	   		if(name === "copy"){
	   			return new CopyService(param);
	   		}
	   		
	   		if(name === "edit"){
				return new EditService(param);
	   		}
	   		
	   		if(name === "display"){
				return new EditService(param);
	   		}
	   		
	   		if(name === "versionCreate"){
	   			return new EditService(param);
	   		}
	   		
	   		if(name === "versionEdit"){
	   			return new EditService(param);
	   		}
	   		
	   		if(name === "versionDisplay"){
	   			return new EditService(param);
	   		}
	   		
	   		if(name === "locationGroups"){
	   			return new EditService(param);
	   		}
	   		
	   		return new NothingService();
		}
	};
}, true);

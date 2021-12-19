/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["sap/ui/model/json/JSONModel",
               "retail/pmr/promotionaloffers/utils/Utils"], 
               function(JSONModel,Utils){
	
	function getIdByItem(item){
		return item.NodeId || item.LocationId || item.ExtLocationNodeId;
	}
	
	function VersionsHelper(data){
		this.availableVersions = jQuery.extend(true, [], data.Versions).map(function(item){
			item.LocationId = item.LocationNodeId;
			delete item.LocationNodeId;
			return item;
		});
		this.availableHierarchy = jQuery.extend(true, [], data.LocationHierarchy);
		this.availableLocalNodes = jQuery.extend(true, [], data.LocalNodes);
		
		this.manipulateHierarchy();
		
		var rawData = Utils.filterData(this.availableHierarchy);	
		this.hierarchy = Utils.buildHierarchyVH(rawData);
		
		this.markUserCreatedNodes();
		this.calculateBreadcrumb();
	}
	
	VersionsHelper.prototype.markUserCreatedNodes = function(items){
		var userCreatedNodes = [];
		
		var recSearchFlag = function(items){
			if(items && items.userCreatedNode){
				appendUnique(getIdByItem(items));
			}
			
			for(var i in items){
				if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
					recSearchFlag(items[i]);
				}
			}
		};
		
		var appendUnique = function(item){
			if(userCreatedNodes.length === 0){
				userCreatedNodes.push(item);				
			}
			else{
				var found = false;
				for(var i = 0, iLen = userCreatedNodes.length; i < iLen; i++){
					if(userCreatedNodes[i] === item){
						found = true;
					}						
				}
				
				if(found){
					userCreatedNodes.push(item);
				}
			}
		};
		
		var recSearchDeep = function(id,items){
			if(getIdByItem(items) === id){
				recMarkDeep(items);
			}
			
			for(var i in items){
				if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
					recSearchDeep(id,items[i]);
				}
			}
		};
		
		var recMarkDeep = function(items){
			items.userCreatedNode = true;
			
			for(var i in items){
				if(items.hasOwnProperty(i) && jQuery.isNumeric(i)){
					recMarkDeep(items[i]);
				}
			}
		};
		
		recSearchFlag(this.hierarchy[0]);
		for(var i = 0, iLen = userCreatedNodes.length; i < iLen; i++) {
			recSearchDeep(userCreatedNodes[i],this.hierarchy[0]);
		}		
	};
	VersionsHelper.prototype.manipulateHierarchy = function(){
		if(this.availableLocalNodes && this.availableLocalNodes.length > 0){
			//change hierarchy structure
			var localnodes = this.availableLocalNodes;
			for(var i = 0, iLen = localnodes.length; i < iLen; i++){
				var localNodeId = localnodes[i].Id || localnodes[i].Description;
				var versionName = this.getUserCreateNodeNameFromVersion(localNodeId);
				var children = localnodes[i].Children || [];
				var newLocations = [];
				var childrenNames = [];
				var childrenLocationIds = [];
				for(var j = 0, jLen = children.length; j < jLen; j++){
					//find all children nodes
					var result = this.moveToNewParent(children[j]);
					if(result){
						newLocations.push(result);
						var toDisplay = result.ExtNodeId || result.ExtLocationId;
						if (result.Name) {
							toDisplay = result.Name + " (" + toDisplay + ")"; 
						}
						childrenNames.push(toDisplay);
						childrenLocationIds.push(result.LocationId || result.NodeId);
					}
				}
				var nameForRead = childrenNames.join(";");
				var locationIds = childrenLocationIds.join(";");
				var locations = newLocations.length > 0 ? newLocations : [];
				this.availableHierarchy.push({Locations : locations,
					NodeId : localnodes[i].Id,
					ParentId : localnodes[i].ParentId,
					ExtNodeId : localnodes[i].Description,
					userCreatedNode: true,
					NodeName: nameForRead,
					VersionName: versionName,
					LocationIds: locationIds});
			}
		}
	};
	
	VersionsHelper.prototype.getUserCreateNodeNameFromVersion = function(id){
		var versions = this.availableVersions;
		if (!versions) {
			return null;
		}
		for (var i = 0; i < versions.length; i++) {
			var locationId = versions[i].LocationId || versions[i].LocationNodeId || versions[i].ExtLocationNodeId;
			if (id === locationId) {
				return versions[i].Name || null;
			}
		}
		return null;
	};
	
	VersionsHelper.prototype.moveToNewParent = function(item){
		var toReturn = null;
		var id = "";
		var itemId = getIdByItem(item);
		
		var availableHierarchy = this.availableHierarchy;
		for(var i = 0, iLen = availableHierarchy.length; i < iLen; i++){			
			id = getIdByItem(availableHierarchy[i]);
			
			if(id === itemId){
				toReturn = jQuery.extend(true, {}, availableHierarchy[i]);
				//availableHierarchy[i].ParentId = item.ParentId;
				//remove from old parent array
				availableHierarchy.splice(i,1);
				break;
			}else{
				var locations = availableHierarchy[i].Locations;
				for(var j = 0; j < locations.length; j++){
					var id = getIdByItem(locations[j]);
					
					if(id === itemId){
						//update old location with new parent id
						//locations[j].ParentNodeId = item.ParentId;
						toReturn = jQuery.extend(true, {}, locations[j]);
						
						//remove from old parent array
						locations.splice(j,1);
						break;
					}
				}
			}						
		}
		
		return toReturn;
	};
	
	VersionsHelper.prototype.calculateBreadcrumb = function(){
		
		var that = this;
		var flatten = [];
		Utils.flattenTree(flatten,this.hierarchy);
		
		//find node in flatten array
		var findNode = function(id){
			for(var i = 0, iLen = flatten.length; i < iLen; i++){
				if(flatten[i].NodeId === id || flatten[i].LocationId === id){
					return flatten[i];
				}
			}
		};
		
		//create breadcrumb
		var breadcrumb = function(items,item) {
			for(var i = 0, iLen = items.length; i < iLen; i++){
				if(getIdByItem(items[i]) === item.ParentId){
					item.Path = items[i].ExtNodeId + " > " + item.Path;	
					
					if(Utils.isInitial(items[i].ParentId)){
						item.ParentId = items[i].ParentId;
						break;
					}else{	
						item.ParentId = items[i].ParentId;
						breadcrumb(items,item);
					} 
				}
				  	   	
			}				
		};
		
		var mapLocalNodesToVersion = function(){
			var versions = that.availableVersions;
			var localNodes = that.availableLocalNodes;
			
			for(var i = 0, iLen = versions.length; i < iLen; i++){
				for(var j = 0, jLen = localNodes.length; j < jLen; j++){
					var localNodeId = localNodes[j].Id || localNodes[j].Description;
					if(getIdByItem(versions[i]) === localNodeId){
						versions[i].LocalNodes = localNodes[j];
					}
				}
			}
		};
		
		var localnodeBreadcrumb = function(localNode){
			localNode.Crumbs = [];
			if(localNode.Children === null) {
				return;
			}
			for(var i = 0, iLen = flatten.length; i < iLen; i++){
				for(var j = 0, jLen = localNode.Children.length; j < jLen; j++){
					if(getIdByItem(localNode.Children[j]) === getIdByItem(flatten[i])){
						var child = flatten[i].Name || flatten[i].ExtNodeId || flatten[i].ExtLocationId;
						var path = child;
						
						localNode.Crumbs.push({Path: path, ParentId: localNode.ParentId});
					}
				}
			}
		};
		
		var setLocationPath = function(item,version){
			var display = item.ExtNodeId ? item.ExtNodeId : item.Name;
			
			if(version.locationPath){
				version.locationPath = display + " > " + version.locationPath;
			}else{
				
				version.locationPath = display;
			}  
		};
		
		var simpleBreadcrumb = function(items,id,version){
			for(var i = 0, iLen = items.length; i < iLen; i++){
				if(Utils.isInitial(id)){
					break;
				}else if(getIdByItem(items[i]) === id){   						
					setLocationPath(items[i],version);   						
					simpleBreadcrumb(items,items[i].ParentId,version);
				}
			}
		};
		
		var isThisVersionOnAUserNode = function(version) {
			var isOnUserNode = false;
			for (var i = 0; i < that.availableLocalNodes.length; i++) {
				if (version.LocationId === that.availableLocalNodes[i].Id) {
					isOnUserNode = true;
					break;
				}
			}
			if (version.LocalNodes) {
				isOnUserNode = true;
			}
			return isOnUserNode;
		};
		
		//create breadcrumb per versions
		var iterateOverVersions = function(){
			var versions = that.availableVersions;
			
			for(var z = 0, zLen = versions.length; z < zLen; z++){
				if(versions[z].LocalNodes){
					//localnode breadcrumb
		   			localnodeBreadcrumb(versions[z].LocalNodes);
		   			
		   			var crumbs = versions[z].LocalNodes.Crumbs;
		   			for(var j = 0, jLen = crumbs.length; j < jLen; j++){
		   				breadcrumb(flatten,crumbs[j]);
		   			}
		   			
		   			var path = "";
					for(var q = 0, qLen = crumbs.length; q < qLen; q++){
						if(path && crumbs[q].Path){	
							var pathArray = crumbs[q].Path.split(">");
							path += pathArray[pathArray.length - 1].trim() + ";";
						}
						else if(path === ""){
							path += crumbs[q].Path + ";";
						}						
					}
					
					versions[z].locationPath = path;
				}
				else{   					
					simpleBreadcrumb(flatten,getIdByItem(versions[z]),versions[z]);
				}   				
			}
		};
		
		
		//map localnodes to versions
		mapLocalNodesToVersion();
		
		//iterate over versions
		iterateOverVersions();
		
	};
	
	VersionsHelper.prototype.getAvailableVersions = function(){
		return this.availableVersions;
	};
	
	VersionsHelper.prototype.getHierarchy = function(){
		return this.hierarchy;
	};
	
	VersionsHelper.prototype.getAvailableHierarchy = function(){
		return this.availableHierarchy;
	};
	
	return VersionsHelper;
}, true);
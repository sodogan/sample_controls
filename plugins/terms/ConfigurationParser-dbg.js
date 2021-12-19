/*
 * Copyright (C) 2009-2019 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([], function(){

	function byRuleControl(value){
		return function(item){
			return item.Control === value;
		};
	}

	function bySectionName(value){
		return function(item){
			return item.Name === value;
		};
	}

	function mapPropertiesToRule(rulesForCurrentControl){
		var mapOfRuleToProperties = {};
		for(var i = 0; i < rulesForCurrentControl.length; i++){
			var currentProperty = rulesForCurrentControl[i];
			mapOfRuleToProperties[currentProperty.Property] = currentProperty.Value;
		}
		return mapOfRuleToProperties;
	}

	function mapRulesToControls(rules){
		var mapOfRulesToControls = {};
		for(var i = 0; i < rules.length; i++){
			var currentRule = rules[i];
			var rulesForCurrentControl = rules.filter(byRuleControl(currentRule.Control));
			mapOfRulesToControls[currentRule.Control] = mapPropertiesToRule(rulesForCurrentControl);
		}
		return mapOfRulesToControls;
	}

	function toParsedSection(item){
		var rulesMap = mapRulesToControls(item.Rules);
		return Object.keys(rulesMap).reduce(function(result, rule){
			result[rule] = {
				Visible : rulesMap[rule].hidden === "true" ? false : true,
				DefaultValue : rulesMap[rule].value ? rulesMap[rule].value.trim() : null,
				Editable : rulesMap[rule].readOnly === "true" ? false : true
			};
			return result;
		}, {});
	}



	function ConfigurationParser(options){
		this.options = options || {};
	}

	ConfigurationParser.prototype = {
		parse : function(sections) {
			var options = this.options;
			if(!sections){
				return Object.keys(options).reduce(function(result, value){
					result[value] = [];
					return result;
				}, {});
			}
			return Object.keys(options).reduce(function(parsedConfigs, configKey){
				var sectionName = options[configKey];
				parsedConfigs[configKey] = sections.filter(bySectionName(sectionName)).map(toParsedSection);
				return parsedConfigs;
			}, {});

		}
	};

	return ConfigurationParser;
});
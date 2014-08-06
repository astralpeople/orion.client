/*******************************************************************************
  * @license
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*eslint-env browser,amd*/

define(['i18n!cfui/nls/messages', 'orion/xhr', 'orion/plugin', 'orion/cfui/cFClient', 'orion/serviceregistry', 'domReady!'],
		function(messages, xhr, PluginProvider, CFClient, ServiceRegistry) {

	var temp = document.createElement('a');
	var login = temp.href;
	
	var headers = {
		name: "Cloud Foundry",
		version: "1.0",
		description: "This plugin integrates with Cloud Foundry.",
		//login: login
	};

	var provider = new PluginProvider(headers);
	var cFService = new CFClient.CFService();

	// Add "Deploy" category to hamburger
//	provider.registerService("orion.page.link.category", null, {
//		id: "deploy",
//		nameKey: "Deploy",
//		nls: "orion/edit/nls/messages",
//		imageClass: "core-sprite-deploy",
//		order: 60
//	});

	// initialize service registry and EAS services
	var serviceRegistry = new ServiceRegistry.ServiceRegistry();
	
	temp.href = "../../prefs/user";
	var location = temp.href;
	
	function PreferencesProvider(location) {
		this.location = location;
	}

	PreferencesProvider.prototype = {
		get: function(name) {
			return xhr("GET", this.location + name, {
				headers: {
					"Orion-Version": "1"
				},
				timeout: 15000,
				log: false
			}).then(function(result) {
				return result.response ? JSON.parse(result.response) : null;
			});
		},
		put: function(name, data) {
			return xhr("PUT", this.location + name, {
				data: JSON.stringify(data),
				headers: {
					"Orion-Version": "1"
				},
				contentType: "application/json;charset=UTF-8",
				timeout: 15000
			}).then(function(result) {
				return result.response ? JSON.parse(result.response) : null;
			});
		},
		remove: function(name, key){
			return xhr("DELETE", this.location + name +"?key=" + key, {
				headers: {
					"Orion-Version": "1"
				},
				contentType: "application/json;charset=UTF-8",
				timeout: 15000
			}).then(function(result) {
				return result.response ? JSON.parse(result.response) : null;
			});
		}
	};
	
	var service = new PreferencesProvider(location);
	serviceRegistry.registerService("orion.core.preference.provider", service, {});

	// cf settings
	var apiUrl = "";
	var manageUrl = "";
	provider.registerService("orion.core.setting", null, {
		settings: [{
			pid: "org.eclipse.orion.client.cf.settings",
			name: messages['Settings'],
			category: messages['Cloud'],
			properties: [{
				id: "targetUrl",
				name: messages['API URL'],
				type: "string",
				defaultValue: apiUrl
			}, {
				id: "manageUrl",
				name: messages['Manage URL'],
				type: "string",
				defaultValue: manageUrl
			}]
		}]
	});
	
	/////////////////////////////////////////////////////
	// add CF shell commands
	/////////////////////////////////////////////////////

	/** Register parent cf root command **/
	provider.registerServiceProvider(
		"orion.shell.command", null, {
		name: "cfo",
		description: "Commands for interacting with a Cloud Foundry compatible target"
	});
	
	/** Add cf target command **/
	var targetImpl = {
		callback: function(args) {
			if (args.url) {
				return cFService.setTarget(args.url, args.org, args.space).then(function(result) {
					if (result) {
						return "target: " + result.Url;
					} else {
						return "Target not set";
					}
				});
			} else {
				return cFService.getTarget().then(function(result) {
					return "target: " + result.Url;
				});
			}
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		targetImpl, {
			name: "cfo target",
			description: "Set or display the target cloud, organization, and space",
			parameters: [{
				name: "url",
				type: "string",
				description: "Target URL to switch to",
				defaultValue: null
			}, {
				name: "org",
				type: "string",
				description: "Organization",
				defaultValue: null
			}, {
				name: "space",
				type: "string",
				description: "Space",
				defaultValue: null
			}]
		}
	);
	
	/** Add cf info command **/
	var infoImpl = {
		callback: function(args) {
			return cFService.getInfo().then(function(result) {
				var value = result.description + 
					"\nversion: " + result.version +
					"\nsupport: " + result.support;
				
				if (result.user) {
					value += "\n\nuser: " + result.user;
				}
				
				return value;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		infoImpl, {
			name: "cfo info",
			description: "Display information on the current target, user, etc."
		}
	);
	
	/** Add cf orgs command **/
	function describeOrg(org) {
		var name = org.Name;
		var strResult = name;

		strResult += ": ";
		if (org.Spaces){
			org.Spaces.forEach(function(space, index){
				strResult += space.Name;
				if (index < org.Spaces.length - 1)
					strResult += ", ";
			});
		} else {
			strResult += "<none>";
		}
		
		return strResult;
	}
	
	var orgsImpl = {
		callback: function(args) {
			return cFService.getOrgs().then(function(result) {
				result = result.Orgs;
				
				if (!result || result.length === 0) {
					return "No orgs.";
				}
				var strResult = "";
				result.forEach(function(org) {
					strResult += describeOrg(org);
					strResult += "\n";
				});
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		orgsImpl, {
			name: "cfo orgs",
			description: "List all orgs"
		}
	);
	
	/** Add cf login command **/
	var loginImpl = {
		callback: function(args) {
			return cFService.login(null, args.username, args.password,
				args.org, args.space).then(function(result) {
					return "Logged in";
				}
			);
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		loginImpl, {
			name: "cfo login",
			description: "Log user in",
			parameters: [{
				name: "username",
				type: "string",
				description: "Username",
				defaultValue: null
			}, {
				name: "password",
				type: "string",
				description: "Password",
				defaultValue: null
			}, {
				name: "org",
				type: "string",
				description: "Organization",
				defaultValue: null
			}, {
				name: "space",
				type: "string",
				description: "Space",
				defaultValue: null
			}]
		}
	);

	/** Add cf logout command **/
	var logoutImpl = {
		callback: function(args) {
			return cFService.logout().then(function(result) {
				return "Logged out";
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		logoutImpl, {
			name: "cfo logout",
			description: "Log user out"
		}
	);
	
	/** Add cf apps command **/
	function describeApp(app) {
		var name = app.Name;
		var strResult = "\n" + name + "\t";
//		if (name.length <= 4) {
//			strResult += "\t";
//		}
//		strResult += app.state + "\t";
//		var runningInstances = app.runningInstances;
//		if (!runningInstances) {
//			runningInstances = 0;
//		}
//		var mem = app.memory;
//		strResult += runningInstances + " x " + mem + "M\t";
//		var url = app.urls[0];
//		strResult += "\t[" + url + "](http://" + url + ")";
		return strResult;
	}
	
	var appsImpl = {
		callback: function(args) {
			return cFService.getApps().then(function(result) {
				result = result.Apps;
				
				if (!result || result.length === 0) {
					return "No applications.";
				}
				var strResult = "\nname\tstate\tinstances\tmemory\tdisk\turls\n";
				result.forEach(function(app) {
					strResult += describeApp(app);
				});
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		appsImpl, {
			name: "cfo apps",
			description: "List all apps in the target space"
		}
	);

	/** Add cf app command **/
	function describeAppVerbose(app) {
		var name = app.name;
		var strResult = "\n" + name + ": ";
		var runningInstances = app.running_instances;
		var instances = app.instances;
		if (!runningInstances) {
			runningInstances = 0;
		}
		var percentage = runningInstances / instances * 100;
		strResult += percentage + "%";
		strResult += "\n\tusage: " + app.memory + "M x ";
		strResult += runningInstances + " instance(s)";
		strResult += "\n\turl: ";
		
		if (app.routes && app.routes.length > 0){
			var host = app.routes[0].host;
			var domain = app.routes[0].domain.name;
			var route = host + "." + domain;
			strResult += "[" + route + "](http://" + route + ")";
		}
		
		return strResult;
	}
	
	var appImpl = {
		callback: function(args, context) {
			return cFService.getApp(null, args.app, context.cwd).then(function(result) {
				if (!result) {
					return "Application not found";
				}
				return describeAppVerbose(result);
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		appImpl, {
			name: "cfo app",
			description: "Display health and status for app",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to show information for",
				defaultValue: null
			}]
		}
	);
	
	/** Add cf push command **/
	var pushImpl = {
		callback: function(args, context) {
			return cFService.pushApp(null, args.app, decodeURIComponent(context.cwd)).then(
				function(result) {
					if (!result || !result.App) {
						return "Application not found";
					}
					
					return cFService.getApp(null, args.app, decodeURIComponent(context.cwd)).then(
						function(result) {
							if (!result) {
								return "Application not found";
							}
							return describeAppVerbose(result);
						}
					);
				}
			);
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		pushImpl, {
			name: "cfo push",
			description: "Push a new app or sync changes to an existing app",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to push",
				defaultValue: null
			}]
		}
	);
	
	/** Add cf start command **/
	var startImpl = {
		callback: function(args, context) {
			return cFService.startApp(null, args.app, context.cwd).then(function(result) {
				if (!result || !result.entity) {
					return "Application not found";
				}
				var app = result.entity;
				if (app.state === "STARTED"){
					return "Application " + app.name + " started";
				} else {
					return "Problems while starting application " + app.name;
				}
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		startImpl, {
			name: "cfo start",
			description: "Start an application",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to start",
				defaultValue: null
			}]
		}
	);

	/** Add cf stop command **/
	var stopImpl = {
		callback: function(args, context) {
			return cFService.stopApp(null, args.app, context.cwd).then(function(result) {
				if (!result || !result.entity) {
					return "Application not found";
				}
				var app = result.entity;
				if (app.state === "STOPPED"){
					return "Application " + app.name + " stopped";
				} else {
					return "Problems while stopping application " + app.name;
				}
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		stopImpl, {
			name: "cfo stop",
			description: "Stop an application",
			parameters: [{
				name: "app",
				type: "string",
				description: "Application to stop",
				defaultValue: null
			}]
		}
	);
	
	/** Add cf routes command **/
	function describeRoute(route) {
		var host = route.Host;
		var strResult = "\n" + host + "\t";
		if (host.length <= 4) {
			strResult += "\t";
		}
		strResult += route.DomainName + "\t";
		return strResult;
	}
	
	var routesImpl = {
		callback: function(args) {
			return cFService.getRoutes().then(function(result) {
				if (!result || !result.Routes || result.Routes.length === 0) {
					return "No routes.";
				}
				var strResult = "\nhost\tdomain\tapps\n";
				result.Routes.forEach(function(route) {
					strResult += describeRoute(route);
				});
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		routesImpl, {
			name: "cfo routes",
			description: "List all routes in the target space"
		}
	);
	
	/** Add cf create-route command **/
	var createRouteImpl = {
		callback: function(args, context) {
			return cFService.createRoute(null, args.domain, args.hostname).then(function(result) {
				if (!result || result.Type !== "Route") {
					return "No routes found";
				}
				var strResult = "\nCreated " + result.Host + " at " + args.domain;
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		createRouteImpl, {
			name: "cfo create-route",
			description: "Create a url route in a space for later use",
			parameters: [{
				name: "domain",
				type: "string",
				description: "Domain"
			}, {
				name: "hostname",
				type: "string",
				description: "Hostname"
			}]
		}
	);
	
	/** Add cf delete-route command **/
	var deleteRouteImpl = {
		callback: function(args, context) {
			return cFService.deleteRoute(null, args.domain, args.hostname).then(function(result) {
				if (!result || !result.Routes) {
					return "No routes found";
				}
				var strResult = "";
				result.Routes.forEach(function(item) {
					strResult += "\nDeleted " + item.Host + " at " + item.DomainName;
				});
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		deleteRouteImpl, {
			name: "cfo delete-route",
			description: "Delete a route",
			parameters: [{
				name: "domain",
				type: "string",
				description: "Domain"
			}, {
				name: "hostname",
				type: "string",
				description: "Hostname"
			}]
		}
	);
	
	/** Add cf delete-orphaned-routes command **/
	var deleteRouteImpl = {
		callback: function(args, context) {
			return cFService.deleteOrphanedRoutes(null).then(function(result) {
				if (!result || !result.Routes) {
					return "No orphaned routes";
				}
				var strResult = "";
				result.Routes.forEach(function(item) {
					strResult += "\nDeleted " + item.Host + " at " + item.DomainName;
				});
				return strResult;
			});
		}
	};
	
	provider.registerServiceProvider(
		"orion.shell.command",
		deleteRouteImpl, {
			name: "cfo delete-orphaned-routes",
			description: "Delete all orphaned routes (e.g.: those that are not mapped to an app)",
			parameters: []
		}
	);

	/* Debug commands */
	provider.registerService(
		"orion.shell.command",
		{}, {
			name: "cfo debug",
			description: "Commands to instrument an app for debugging."
		}
	);

	/* Add cf debug add command */
	provider.registerService(
		"orion.shell.command", {
			callback: function(args, context) {
				return cFService.addDebug(decodeURIComponent(args.cwd), args.password, args.urlPrefix).then(function(result) {
					if (result.App)
						return "Debugging enabled for app " + result.Name; //whatever
					return result;
				});
			}
		}, {
			name: "cfo debug add",
			description: "Add CF debugging support to a Node.js application",
			parameters: [{
				name: "password",
				type: "string",
				description: "A password that will restrict access to the debugger.",
			},{
				name: "urlPrefix",
				type: "string",
				description: "Optional URL prefix reserved for the debugger.",
				defaultValue: "" // optional
			}]
		}
	);

	/** Add cf map-route command **/
//	var mapRouteImpl = {
//		callback: function(args, context) {
//			return cFService.mapRoute(null, args.app, args.domain, args.hostname).then(function(result) {
////				if (!result || !result.Routes) {
////					return "No orphaned routes";
////				}
////				var strResult = "";
////				result.Routes.forEach(function(item) {
////					strResult += "\nDeleted " + item.Host + " at " + item.DomainName;
////				});
//				
//				// TODO: make better handling
//				return "Mapping added";
//			});
//		}
//	};
//	
//	provider.registerServiceProvider(
//		"orion.shell.command",
//		mapRouteImpl, {
//			name: "cfo map-routes",
//			description: "Add a route to an app",
//			parameters: [{
//				name: "app",
//				type: "string",
//				description: "Application"
//			}, {
//				name: "domain",
//				type: "string",
//				description: "Domain"
//			}, {
//				name: "hostname",
//				type: "string",
//				description: "Hostname"
//			}]
//		}
//	);
//	
//	/** Add cf unmap-route command **/
//	var unmapRouteImpl = {
//		callback: function(args, context) {
//			return cFService.unmapRoute(null, args.app, args.domain, args.hostname).then(function(result) {
////					if (!result || !result.Routes) {
////						return "No orphaned routes";
////					}
////					var strResult = "";
////					result.Routes.forEach(function(item) {
////						strResult += "\nDeleted " + item.Host + " at " + item.DomainName;
////					});
//				
//				// TODO: make better handling
//				return "Mapping deleted";
//			});
//		}
//	};
//	
//	provider.registerServiceProvider(
//		"orion.shell.command",
//		unmapRouteImpl, {
//			name: "cfo unmap-routes",
//			description: "Delete a route from an app",
//			parameters: [{
//				name: "app",
//				type: "string",
//				description: "Application"
//			}, {
//				name: "domain",
//				type: "string",
//				description: "Domain"
//			}, {
//				name: "hostname",
//				type: "string",
//				description: "Hostname"
//			}]
//		}
//	);
	
	provider.connect();
});

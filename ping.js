/**
*      Copyright (C) 2008 10gen Inc.
*
*    Licensed under the Apache License, Version 2.0 (the "License");
*    you may not use this file except in compliance with the License.
*    You may obtain a copy of the License at
*
*       http://www.apache.org/licenses/LICENSE-2.0
*
*    Unless required by applicable law or agreed to in writing, software
*    distributed under the License is distributed on an "AS IS" BASIS,
*    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*    See the License for the specific language governing permissions and
*    limitations under the License.
*/

/**
 * Service to automatically ping weblogs when a new blog post or page is created.
 *
 * Specification: http://www.xmlrpc.com/weblogsCom
 *
**/

core.ws.xmlrpc.client();

/** A list of pinging services. Includes Feedburner, Technorati, Google Blogsearch, Weblogs, and Pheedo.
 * @type Array
 */
Blog.pingService = [
    {url: 'ping.feedburner.google.com', port: 80, path: '/'},
    {url: 'rpc.technorati.com', port: 80, path: '/rpc/ping'},
    {url: 'blogsearch.google.com', port: 80, path: '/ping/RPC2'},
    {url: 'rpc.weblogs.com', port: 80, path: '/RPC2'},
    {url: 'www.pheedo.com', port: 80, path: '/api/rpc/'},
];

/** Forks a new process to tell the services listed in Blog.pingService about a given url.
 * @param {string} articleUrl the url of the article of which to inform feed services
 */
Blog.ping = function(articleUrl) {
    t = fork( Blog.pingSync , articleUrl );
    t.start();
}

/**
 * Pings all of the services listed in Blog.pingService about the given URL.
 * @param {string} url URL of which to inform services
 */
Blog.pingSync = function(articleUrl) {
  var siteName = siteScope ? siteScope.siteName : siteName;
  var siteUrl = siteScope ? siteScope.siteUrl : siteUrl;

    // if articleUrl is empty, ping just the entire blog, instead of an individual article
    if (!articleUrl || articleUrl.length == 0) {
         articleUrl = siteUrl;
    }

    // cycle through all of the defined ping services
    Blog.pingService.forEach( function(service) {

        log.blog.ping.info('Pinging: ' + service.url + ":" + service.port + service.path + " url = " + articleUrl);

        var client = new ws.xmlrpc.Client(service.url, service.port, service.path);
        var response = null;
        try {
            response = client.methodCall('weblogUpdates.ping', [siteName, siteUrl, articleUrl]);
        }
        catch ( e ){
            log.blog.ping.error( "Exception : couldn't ping : " + tojson( service ) + " because of " + e );
            return;
        }

        if (!response) {
            log.blog.ping.inerrorfo('Got empty response');
        } else {
            if (response.isFault) {
                // we got a fault
                log.blog.ping.error('Fault: (' + response.faultValue + ') ' + response.faultString);
            } else {
                var flerror;
                var message;
                response.value.children.forEach( function(member) {
                    var name = member.children[0].$;
                    if (name == 'flerror') {
                        flerror = member.children[1].children[0].$;
                    } else if (name == 'message') {
                        if (isArray(member.children[1].children)) {
                            message = member.children[1].children[0].$;
                        } else {
                            message = member.children[1].$;
                        }
                        message = message.replace(/&#32;/g, ' ');
                    }

                })
                log.blog.ping.info('Success: ' + service.url + ":" + service.port + service.path + " url = " + articleUrl
                        + " :: "+ message + ' (flerror: ' + flerror + ')');
            }
        }
    });

};


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

core.content.search();
core.text.text();
core.media.image();
core.util.timeoutcache();
core.ext.getlist();

/** @constructor Creates a new blog post
 * @param {string} name The URL at which the post can be found
 * @param {string} title Post title
 */
function Post(name, title) {
    this.name = name;
    this.title = title;
    this.commentsEnabled = true;
    this.ts = new Date();
    this.cls = "entry";
    this.content = "";
    this.views = 0;
    this.categories = new Array();
};

/** Fields: title, author, content, and excerpt
 * @type Object
 */
Post.prototype.SEARCH_FIELDS = { title : 1 , author : 1  , content : .2, excerpt : .2 };
Post.prototype.SEARCH_OPTIONS = { stripHTML : true };

/** Get a substring of this post's content, up to the first instance of "---JUMP---".
 * @return A substring of this post's content.
 */
Post.prototype.getTeaserContent = function(){
    return this.content.replace( /---JUMP---.*/m , "" );
};

/** Clean and return the full content.  Cleaning involves removing "---JUMP---" if this post's content contains the string and making sure that the size of images is not too large.
 * @return {string} Cleaned content.
 */
Post.prototype.getFullContent = function(){
    var html = this.content.replace( /---JUMP---[\r\n]*/ , "" );
    html = Media.Image.giveIMGTagsURLMaxes( html );
    return html;
};

Post.prototype.getContent = function( full ){
    if ( full )
        return this.getFullContent();
    return this.getTeaserContent();
};

Post.prototype.hasJump = function(){

    var idx = this.content.indexOf( "---JUMP---" );

    if ( idx < 0 ) return false;

    idx = idx + 10;

    return ( idx + 10 ) < this.content.length;
};

Post.prototype.getNumCommentsSince = function( when ){
    if ( ! when )
        return this.getNumComments();

    var c = this.getComments();
    if ( ! c )
        return 0;

    var num = 0;
    for ( var i=0; i<c.length; i++ ){
        if ( c[i].ts < when ){
            continue;
        }
        num++;
    }
    return num;
}

Post.prototype.getNumComments = function(){
    if ( !this.comments )
        return 0;

    if ( isArray( this.comments ) )
        return this.comments.length;

    var numComments = 0;
    for (var key in this.comments) {
        if (key == 'length') continue;
        numComments++;
    }
    return numComments;
};

Post.prototype.deleteComment = function(cid){
    var l = log.blog.post.deleteComment;
    l.debug( cid );

    if ( ! this.comments ){
        l.debug( "no comments" );
        return;
    }

    if ( ! isArray( this.comments ) )
        this.getComments();

    if ( isArray( this.comments ) ){
        l.debug( "array version" );
        this.comments = this.comments.filter( function(z){
                return z.cid.toString() != cid.toString();
            } );
        return;
    }

    l.debug( "old object thing" );
    delete this.comments[cid];
};

Post.prototype.addComment = function( comment ){

    if ( ! this.comments )
        this.comments = [];

    comment.text = comment.text.replace(/<{1}?(?=\/?(a|i|b|strong|em|table|tr|th|td)( |>))/g,"##&##").replace(/<[^>]+>/g," ").replace(/##&##/g,"<");
    // Strip elements like <a href="...></a> (missing closing quote).
    // Leaves closing elements; that sucks but hopefully the browser can handle
    // it.
    comment.text = comment.text.replace(/<[^>]+"[^>"]+>/g, "");
    // Similarly with tags like <a href="..."</a>.
    comment.text = comment.text.replace(/<[^>]+</g, "<");
    comment.cid = ObjectID();

    if ( isArray( this.comments ) )
        this.comments.push( comment );
    else
        this.comments[comment.cid.toString()] = comment;
};

Post.prototype.getComments = function() {
    if ( ! this.comments )
        return [];
    if ( isArray( this.comments ) )
        return this.comments;

    var commentsArray = Array();
    for (var key in this.comments) {
        if (key == 'length') continue;
        commentsArray.push(this.comments[key]);
    }

    // sort them by date
    commentsArray = commentsArray.sort( function (a, b) { return b.ts - a.ts; });
    this.comments = commentsArray;

    return this.comments;
};

Post.prototype.presave = function(){
    var extraFields = Ext.getlist(allowModule, 'blog', 'extraFields') || {};
    for(var key in extraFields){
        var weight = Ext.getlist(extraFields, key, 'searchWeight');
        if(weight != null)
            Post.prototype.SEARCH_FIELDS[key] = weight;
    }

    Search.index( this , this.SEARCH_FIELDS , this.SEARCH_OPTIONS );
};

Post.prototype.getExcerpt = function(){
    if ( this.excerpt )
        return this.excerpt;

    var foo = this.getTeaserContent();
    if ( foo == null )
        return null;

    return Text.snippet( foo );
};

Post.prototype.getUrl = function( r ){
    if ( ! r && request )
        r = request;

    var u = r ? "http://" + r.getHeader( "Host" ) : "";
    u += "/" + this.name;

    return u;
};

Post.prototype.getNextPost = function( filter ){
    var s = { live : true , cls : "entry" , ts : { $lt : this.ts } };
    if ( filter )
        Object.extend( s , filter );

    var cursor = db.blog.posts.find( s );
    cursor.sort( { ts : -1 } );
    cursor.limit( 1 );

    if ( cursor.hasNext() )
        return cursor.next();

    return null;
};

Post.prototype.getPreviousPost = function( filter ){
    var s = { live : true , cls : "entry" , ts : { $gt : this.ts } };
    if ( filter )
        Object.extend( s , filter );
    var cursor = db.blog.posts.find( s );
    cursor.sort( { ts : 1 } );
    cursor.limit( 1 );

    if ( cursor.hasNext() )
        return cursor.next();

    return null;
};

Post.prototype.getFirstImageSrc = function( maxX , maxY ){
    if ( ! this.content )
        return null;

    if ( this.suppressImage )
        return null;

    var p = /<img[^>]+src="(.*?)"/;
    var r = p.exec( this.content );
    if ( ! r )
        return null;

    var url = r[1];

    if ( ! url.match( /f?id=/ ) )
        return null;

    if ( ( maxX || maxY ) ){
        url = url.replace( /.*f?id=/ , "/~~/f?id=" );

        if ( maxX )
            url += "&maxX=" + maxX;

        if ( maxY )
            url += "&maxY=" + maxY;
    }

    return url;
};

// This gets called before saving in posts or drafts
Post.prototype.format = function(){
    /* Site-specific formatting */
    var that = this;
    Object.keys(this).forEach(function(key){
        if(Ext.getlist(allowModule, 'blog', 'format', key)){
            var format = allowModule.blog.format[key];
            if(typeof format == "function")
                format = [format];
            that["_original_"+key] = that[key];
            var text = that[key];
            format.forEach(function(z){ text = z(text); });
            that[key] = text;
        }
    });
};

// This gets called before loading in post_edit and nowhere else.
// This can't be a post_load because it must not happen before rendering
// a post in a blog.
Post.prototype.unformat = function(){
    for(var key in this){
        if(key.startsWith("_original_")){
            this[key.replace(/^_original_/, '')] = this[key];
	}
    }
};


Post.prototype.getAuthorCat = function(){
    if(!this.author) return null;
    var cat = db.blog.categories.findOne({author: this.author});
    if(!cat) return cat;
    return cat.name;
};


Post.get404 = function() {
    http404Page = db.blog.posts.findOne({ name: '404' });
    if (!http404Page) {
        http404Page = new Post('404', '404');
        http404Page.cls = 'page';
        http404Page.live = true;
        http404Page.commentsEnabled = false;
        http404Page.dontSearch = true;
        db.blog.posts.save(http404Page);
    }
    return http404Page;
};

Post.getNoResults = function() {
    noResultsPage = db.blog.posts.findOne({ name: 'no_results' });
    if (!noResultsPage) {
        noResultsPage = new Post('no_results', 'No Results');
        noResultsPage.cls = 'page';
        noResultsPage.live = true;
        noResultsPage.commentsEnabled = false;
        noResultsPage.dontSearch = true;
        db.blog.posts.save(noResultsPage);
    }
    return noResultsPage;
};

Post.cache = new TimeOutCache();

Post.getMostPopular = function( num , articlesBack ){

    num = num || 10;
    articlesBack = articlesBack || 100;

    var key = "__mostPopular_" + num + "_" + articlesBack;
    var all = Post.cache.get( key );
    if ( all )
        return all;

    all = [];

    var sortFunc = function( a , b ){
            return b.views - a.views;
    };

    var cursor = db.blog.posts.find( Blog.blogUtils.liveEntry() ).sort( { ts : -1 } ).limit( articlesBack );
    while ( cursor.hasNext() ){
        all.push( cursor.next() );
        all = all.sort( sortFunc );
        all = all.slice( 0 , num );
    }

    Post.cache.add( key , all );
    return all;
};

Post.getMostCommented = function( num , articlesBack , daysBackToCountComments ){

    articlesBack = articlesBack || 100;

    var key = "__mostCommented_" + num + "_" + articlesBack;

    var old = [];
    var all = Post.cache.get( key , old );
    if ( all )
        return all;

    if ( old[0] )
        Post.cache.add( key , old[0] );

    var sinceWhen = null;
    if ( daysBackToCountComments )
        sinceWhen = new Date( (new Date()).getTime() - ( 1000 * 3600 * 24 * daysBackToCountComments ) );

    all = [];
    var sortFunc = function( a , b ){
        if ( ! sinceWhen )
            return b.getNumComments() - a.getNumComments();
        return b.getNumCommentsSince( sinceWhen ) - a.getNumCommentsSince( sinceWhen );
    };
    var cursor = db.blog.posts.find( Blog.blogUtils.liveEntry() ).sort( { ts : -1 } ).limit( articlesBack );
    while ( cursor.hasNext() ){
        all.push( cursor.next() );
        all = all.sort( sortFunc );
        all = all.slice( 0 , num );
    }

    Post.cache.add( key , all );
    return all;
};

function fixComments() {

    SYSOUT('Fixing Comments!');
    cursor = db.blog.posts.find();
    // iterate through each post
    cursor.forEach(function(post) {
        // see what kind of object comments is

        if ( post.comments && ! isArray( post.comments ) ){
            SYSOUT('Converting Post ID (' + post._id + ')');
            post.comments = post.getComments();
        }

        if ( ! post.views )
            post.views = 1;

        db.blog.posts.save(post);
        SYSOUT('\tSaving Post ID (' + post._id + ')');
    });
}


Blog.fixDB = function(){
    db.blog.posts.ensureIndex( { ts : 1 } );
    db.blog.posts.ensureIndex( { categories : 1 } );
    db.blog.posts.ensureIndex( { name : 1 } );

    db.blog.posts.setConstructor( Post );
    db.blog.drafts.setConstructor( Post );

    Search.fixTable( db.blog.posts , Post.prototype.SEARCH_FIELDS );

    //fixComments();
}

if ( db ){
    Blog.fixDB();
}

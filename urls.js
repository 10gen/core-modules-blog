
if ( ! Blog )
    Blog = {};

core.blog.post();
core.blog.category();
core.blog.missingpage();
core.content.search();

Blog.log = log.app.blog;
Blog.log.level = log.LEVEL.ERROR;

/**
   arg ex. {  limit: 2, filter: {categories: "new_york"} } );

   takes a request and returns an object of form
   { isPage : boolean , posts : [ Post ] }
*/
Blog._addFilters = function( searchCriteria , filter ){
    if ( filter ){
        for ( var foo in filter )
            searchCriteria[foo] = filter[foo];
    }
};

/* keep track of all pages that wind up as 404's */
Blog.handleMissingUri = function(uri) {
    var missingPage = new MissingPage(uri);
    db.blog.missingpages.update( missingPage , { $inc : { num : 1 } } , { upsert : true , ids : false } );

    return {isPage: true,
            posts: [Post.get404()],
            isCategorySearch: false,
            baseSearch: uri,
            hasNext: false};

};

Blog.handleRequest = function( request , arg ){
    if (!arg) arg = {};

    var result = {

        posts : [] , 
        isPage : false ,

        isCategorySearch : false ,
        isDateSearch : false ,
        baseSearch : "" , 
        
        hasPrevious : false , 
        hasNext : false , 
        
        category : null ,
        search : request.q ,
        
        pageNumber : 1 ,
        pageSize : arg.limit || 30 ,
        searchTerm : request.q ,
        
        uri : arg.uri || request.getURI()
    };

    with ( result ){
        // define a standard search, which restricts pages/posts to entries that are live, and publishDate earlier than now

        // find any paging instructions in the url
        page = uri.match(/\/page\/([0-9]*)$/);
        if (page) {
            pageNumber = parseInt(page.match(/[0-9]*$/));
            pageNumber = Math.min(Math.max(1, pageNumber), 20); // make sure we can't go below 1

            // don't forget to strip out the page from the processed uri
            uri = uri.replace(page, '');
        }

        if (request.q) {
            posts = Search.search(db.blog.posts, request.q , { min : 100 } );
            posts = posts.filter( function( z ){ return z.live; } );
            posts = posts.sort( function( a , b ){ return -1 * a.ts.compareTo( b.ts ); } );
        
            var postResults = 0;
            var pageStart = (pageNumber - 1) * pageSize;
            var pageEnd = Math.min(pageNumber * pageSize, posts.length);
        
            Blog.log.debug("posts: " + posts.length);

            posts = posts.filter( function( z ) {
                    postResults++
                    return postResults > pageStart && postResults <= pageEnd;
                });
        
            Blog.log.debug("pageStart: " + pageStart + " pageEnd " + pageEnd );
            Blog.log.debug("postResults: " + postResults);
            Blog.log.debug("page: " + pageNumber);

            // setup result
            if ( postResults == 0 ){
                posts.push( Post.getNoResults() );
                return result;
            } 
        
            hasPrevious = pageStart > 1;
            hasNext = postResults > pageEnd;
            return result;
        } 
    
        var searchCriteria = { live : true , ts : { $lt : new Date() } }; // add ts filter
        var entries;
    
        if(arg.filter)
            Blog._addFilters( searchCriteria , arg.filter );
    
        // process the URL
        // strip out the .html and leading and trailing slash if it exists (for MovableType URL migration)
        uri = uri.replace(/\.(jxp|html)$/, '').replace(/index$/, '').replace(/^.rss/ , "/" );
        uri = uri.replace(/\/$/, '').replace(/^\//, '').replace(/-/g, '_').replace( /^(\d\d\d\d)\/0(\d)/ , "$1/$2" );
    
        Blog.log.debug("base URI: " + uri);
        Blog.log.debug("pageNumber: " + pageNumber);
    
        // look for a page or post with name = URL, and display it if it exists.
        if ( uri.length != 0 ){
            searchCriteria.name = uri;
            Blog.log.debug( "searchCriteria : " + tojson( searchCriteria ) );
            var entry = db.blog.posts.findOne(searchCriteria);
        
            if (entry) {
                Blog.log.debug('found a matching ' + entry.cls);

                db.blog.posts.update( { name : uri } , { $inc : { views : 1 } } , { ids : false } );

                isPage = true;
                posts.push( entry );
                return result;
            }
            
            delete searchCriteria.name;
        }
    
        // if the URL is empty, display the home page
        if (uri == '') {
            searchCriteria.cls = 'entry';
            if ( ! searchCriteria.categories )
                searchCriteria.categories = 'home'; // this shouldn't be in the generic blog code, because why would you want to put this kind of limit on the home page by default?
            entries = db.blog.posts.find( searchCriteria ).sort( { ts : -1 } ).limit( pageSize + 1 ).skip( pageSize * ( pageNumber - 1 ) );
        } 
        else {
            // search categories
            searchCriteria.categories = uri;
            entries = db.blog.posts.find(searchCriteria).sort( { ts : -1 } ).limit( pageSize  + 1 ).skip( pageSize * ( pageNumber - 1 ) );
        
            if (entries.length() > 0) {
                Blog.log.debug('found matching entries for category: ' + uri);
                isCategorySearch = true;
                category = db.blog.categories.findOne({ name: uri });
            } 
            else {
                // this isn't a category search, so we just assume its a date search or partial url search
                delete searchCriteria.categories;
            
                searchCriteria.name = new RegExp('^' + uri.replace(/\//g, '\\/'));
                entries = db.blog.posts.find(searchCriteria).sort( { ts : -1 } ).limit( pageSize  + 1 ).skip( pageSize * ( pageNumber - 1 ) );
                if (entries.length() > 0) {
                    Blog.log.debug('found matching entries for: ' + uri);
                }
            }
        }
    
        search = uri;
    
        posts = entries.toArray();
        hasNext = entries.length() > pageSize;
        if (posts.length > pageSize) {
            hasNext = true;
            posts.remove(pageSize);
        }
    
        if (posts.length == 0)
            return Blog.handleMissingUri(uri);
    
    }
    return result;
};

Blog.handlePosts = function( request , thePost , user ){
    if ( user && user.isAdmin() && request.action == "delete" ) {
        thePost.deleteComment( request.cid );
        db.blog.posts.save( thePost );
        return;
    }

    if ( request.addComment == "yes" ) {
        var comment = null;

        Blog.log.debug( "want to add comment" );

        var hasYourName = request.yourname && request.yourname.trim().length != 0;
        var hasEmail = request.email && request.email.trim().length != 0;

        if ( user ) {
            comment = {};
            comment.author = user.name;
            comment.email = user.email;
        }
        else if ( request.yourname && request.yourname.trim().length != 0 && request.email && request.email.trim().length != 0 ) {
            if ( Captcha.valid( request ) ) {
                comment = {};
                comment.author = request.yourname;
                comment.email = request.email;
                comment.url = request.url;
            }
            else {
                return "invalid captcha response : " + request.captcha;
            }
        }

        if ( comment ) {

            comment.ts = new Date();
            comment.text = request.txt;

            thePost.addComment( comment );
            db.blog.posts.save( thePost );

            return "Comment Saved";
        }

        if ( ! hasYourName )
            return "need to specify name";

        if ( ! hasEmail )
            return "need to specify email address";
    }
};

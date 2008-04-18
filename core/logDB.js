// logDB.js

core.db.db();
core.core.mail();

BasicDBAppender = {};

BasicDBAppender.create = function(){

    createCollection( "_logs" , {size:1000000, capped:true} );

    var append = function( loggerName , date , level , msg , throwable , thread ){
        var now = new Date();
        var lvl = level.toString();
        msg = msg.toString();
/*        if(lvl == "FATAL" && now.getTime() > (this.sendEmail.getTime() + 10*60*1000)) {
            m = new Mail.Message( "Fatal Log Message", msg );
            m.addRecipient(  user.email , "to" );
            m.addRecipient(  "kristina@10gen.com" );
            m.send( mail );
            this.sendEmail = now;
        }*/
        var obj = LogUtil.createObject( loggerName , date , lvl , msg , LogUtil.prettyStackTrace( throwable ) , thread.toString() );
        db._logs.save( obj );
    }

    append.isBasicDBAppender = true;
    append.sentEmail = new Date(0);

    return javaCreate( "ed.log.JSAppender" , append );
};

BasicDBAppender.find = function( logger ){
    if ( ! logger )
        return null;

    if ( ! logger.appenders )
        return null;

    for ( var i=0; i<logger.appenders.length; i++ ){
        var a = logger.appenders[i];

        if ( isObject( a ) && a.isBasicDBAppender )
            return a;
    }

    return null;
};
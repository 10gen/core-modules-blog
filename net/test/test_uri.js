core.net.uri();

s = 'http://localhost:8080/a/b/c/?hi=there&you=funny';
u = new URI(s);
assert(u.scheme == 'http');
assert(u.hostname == 'localhost:8080');
assert(u.path == '/a/b/c/');
assert(u.toString() == s);

u = u.replaceArg('you', 'money');
assert(u.toString() == 'http://localhost:8080/a/b/c/?hi=there&you=money');

u = u.addArg('you', 'sunny');
assert(u.toString() == 'http://localhost:8080/a/b/c/?hi=there&you=money&you=sunny');

s = 'localhost:8080/bugs/';
u = new URI(s);

assert(u.scheme == 'http');
assert(u.hostname == 'localhost:8080');
assert(u.path == '/bugs/');

s = "http://localhost:8080/bugs/?number=&title=&owner=Ethan&status=&severity=&type=&project=&area=&creationDate=&lastModified=";
u = new URI(s);

assert(u.scheme = 'http');
assert(u.hostname == 'localhost:8080');
assert(u.path == '/bugs/');

s = "/bugs/?number=&title=";
u = new URI(s);

assert(u.toString() == s);

u = u.removeArg("number");

assert(u.toString() == "/bugs/?title=");


s = "/bugs/?number=&title=&whee=";
u = new URI(s);
u = u.removeArg("title");
assert(u.toString() == "/bugs/?number=&whee=");

s = "/bugs/#anchor1";
u = new URI(s);
assert(u.toString() == s);
assert(u.anchor == "anchor1");

s = "localhost:8080/bugs/?number=1#anchor";
u = new URI(s);
assert(u.toString() == "http://"+s);
assert(u.anchor == "anchor");
assert(u.hostname == "localhost:8080");
assert(u.path == "/bugs/");

s = "/bugs/#anchor1";
u = new URI(s).addArg("number", "40").addArg("truth", "").addArg("you", "honey");
assert(u.toString() == "/bugs/?number=40&truth=&you=honey#anchor1");

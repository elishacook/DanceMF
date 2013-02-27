import re
import json
from cgi import FieldStorage, parse_qs
from urllib import unquote
from wsgiref.simple_server import make_server, WSGIServer
import SimpleHTTPServer
import SocketServer
import threading
import time
import socket

ponies = {}

class TestError(Exception):
    
    def __init__(self, status, message=''):
        super(TestError, self).__init__(message)
        self.status = status
        

class TestRESTApp(object):
    
    routes = [
        (re.compile('^/ponies/$'), 'all'),
        (re.compile('^/ponies/([a-zA-Z0-9\s]+)$'), 'one'),
        (re.compile('^/clear$'), 'clear')
    ]
    
    def __call__(self, environ, start_response):
        self.environ = environ
        self.start_response = start_response
        for pat, n in self.routes:
            match = pat.match(unquote(environ['PATH_INFO']))
            if match:
                return self.handle(environ, start_response, n, match.groups())
        start_response('404 Not Found', [])
        return ''
        
    def handle(self, environ, start_response, route, args):
        if environ['REQUEST_METHOD'] == 'OPTIONS':
            self.respond('200 OK')
            return ''
        
        method_name = 'do_' + environ['REQUEST_METHOD'] + '_' + route
        if not hasattr(self, method_name):
            self.respond('404 Not Found', [])
            return ''
        method = getattr(self, method_name)
        try:
            result = method(*args)
        except TestError, e:
            self.respond(e.status, [('Content-Type', 'text/plain')])
            return e.message
        else:
            data = json.dumps(result).encode('utf-8')
            self.respond('200 OK', [('Content-Type', 'application/x-json')])
            return [data]
            
    def respond(self, status, headers=[]):
        headers += [
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE'),
            ('Access-Control-Allow-Headers', 'origin, accepts')
        ]
        self.start_response(status, headers)
    
    def do_GET_one(self, id):
        if id not in ponies:
            raise TestError('404 Not Found')
        return ponies[id]
        
    def do_GET_all(self):
        options = parse_qs(self.environ['QUERY_STRING'])
        if 'ids' in options:
            ids = unquote(options['ids'][0]).split(',')
            return [p for p in ponies.values() if p['name'] in ids]
        return ponies.values()
        
    def do_POST_all(self):
        pony = self.get_pony_from_request()
        ponies[pony['name']] = pony
        print "PONY MADE: ", pony
        return pony
        
    def do_PUT_one(self, id):
        if id not in ponies:
            raise TestError('404 Not Found')
        pony = self.get_pony_from_request()
        ponies[id] = pony
        print "PONY UPDATED: ", pony
        return pony
        
    def get_pony_from_request(self):
        fields = FieldStorage(
            fp=self.environ['wsgi.input'],
            environ=self.environ.copy(),
            keep_blank_values=True
        )
        if 'name' not in fields:
            raise TestError('400 Bad Request', 'A pony must have a name.')
        
        pony = {}
        for k in fields:
            pony[k] = fields[k].value
        
        return pony
        
    def do_GET_clear(self):
        print 'Clearing ponies...'
        global ponies
        ponies = {}
        

def start_rest_server():
    host, port = 'localhost', 3002
    WSGIServer.allow_reuse_address = True
    httpd = make_server(host, port, TestRESTApp())
    print "Starting REST server on %s:%s" % (host, port)
    httpd.allow_reuse_address = True
    httpd.serve_forever()


def start_test_server():
    server_address = ('localhost', 3003)
    SocketServer.TCPServer.allow_reuse_address = True
    httpd = SocketServer.TCPServer(server_address, SimpleHTTPServer.SimpleHTTPRequestHandler)
    print "Serving tests at http://%s:%s/tests.html" % server_address
    httpd.serve_forever()

threads = []
launchers = [
    start_rest_server,
    start_test_server
]
for fn in launchers:
    t = threading.Thread(target=fn)
    t.setDaemon(True)
    t.start()
    threads.append(t)
    
try:
    while 1:
        time.sleep(0.5)
except KeyboardInterrupt:
    pass